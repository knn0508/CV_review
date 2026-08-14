"""FastAPI app implementing the endpoints documented in README.md, plus
GET /jobs (list, needed so the frontend can route ranking by category rather
than by a specific job id).

Jobs and candidates persist in Postgres (see db.py) — the only in-memory
state left is the ranking cache, which is derived and safe to lose.

Model stages now call real Gemini, per README's table:
  classify              -> gemini-3.5-flash-lite
  parse / judge / review -> gemini-3.6-flash
  final re-rank          -> gemini-3.1-pro (single call over the shortlist)
Each has a `_heuristic_*` fallback (used when GEMINI_API_KEY is unset, or a
call fails/times out) so the app stays usable offline.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import tempfile
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db import CandidateRow, JobRow, async_session, get_session, init_db
from extract import ExtractedDoc, extract
from schemas import (
    CandidateProfile,
    CVReview,
    ExperienceEntry,
    Field_,
    FieldPrediction,
    JobSpec,
    LLMJudgement,
    ScoreBreakdown,
    Seniority,
)

load_dotenv()
logger = logging.getLogger("cv_screening")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
_client = None
if GEMINI_API_KEY:
    from google import genai
    from google.genai import types as genai_types

    _client = genai.Client(api_key=GEMINI_API_KEY)

MODEL_CLASSIFY = "gemini-3.5-flash-lite"
MODEL_WORKHORSE = "gemini-3.6-flash"   # parse job, parse cv, judge, review
MODEL_RERANK = "gemini-3.1-pro"


async def _generate(model: str, prompt: str, schema: type[BaseModel]) -> BaseModel:
    resp = await _client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=schema,
        ),
    )
    if resp.parsed is None:
        raise ValueError(f"Gemini returned unparseable output for {schema.__name__}")
    return resp.parsed


class JobIn(BaseModel):
    description: str


app = FastAPI(title="CV Screening")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _on_startup():
    await init_db()


# ---------- storage ----------
# Jobs and candidates live in Postgres (db.py) so they survive a restart.
# The ranking cache stays in-memory: it's derived from the two tables above,
# not source data, and is invalidated the moment the candidate pool changes.

RANKING_CACHE: dict[tuple, dict] = {}  # (job_id, field, n) -> {pool_key, response}


def _job_from_row(row: JobRow) -> JobSpec:
    return JobSpec(**row.spec)


def _candidate_from_row(row: CandidateRow) -> dict:
    return {
        "file_hash": row.file_hash,
        "profile": CandidateProfile(**row.profile),
        "extracted": ExtractedDoc(**row.extracted),
        "field": row.field,
        "parse_source": row.parse_source,
        "classify_source": row.classify_source,
    }


async def _field_counts(db: AsyncSession) -> dict[str, int]:
    rows = await db.execute(select(CandidateRow.field, func.count()).group_by(CandidateRow.field))
    return dict(rows.all())

FIELD_KEYWORDS: dict[Field_, list[str]] = {
    "frontend": ["react", "vue", "angular", "css", "html", "frontend", "typescript", "javascript", "next.js"],
    "backend": ["django", "flask", "spring", "backend", "api", "microservice", "node.js", "postgres", "database"],
    "fullstack": ["fullstack", "full-stack", "full stack"],
    "mobile": ["ios", "android", "swift", "kotlin", "flutter", "react native", "mobile"],
    "data_engineering": ["etl", "airflow", "spark", "data pipeline", "warehouse", "dbt"],
    "data_science_ml": [
        "data scientist", "data science", "machine learning", "ml", "pytorch", "tensorflow",
        "nlp", "llm", "pandas", "scikit-learn", "sklearn", "deep learning", "predictive model",
        "statistics", "numpy", "jupyter",
    ],
    "devops_sre": ["devops", "sre", "kubernetes", "docker", "terraform", "ci/cd", "aws", "infrastructure"],
    "qa_testing": ["qa", "quality assurance", "test automation", "selenium", "playwright", "cypress"],
    "security": ["security", "penetration test", "infosec", "vulnerability", "soc2"],
    "ui_ux_design": ["ui/ux", "figma", "user research", "wireframe", "prototyping", "ux design"],
    "product_project_management": ["product manager", "project manager", "scrum", "roadmap", "product owner"],
}

SKILL_VOCAB = sorted({kw.strip() for kws in FIELD_KEYWORDS.values() for kw in kws} | {
    "react", "typescript", "css architecture", "accessibility", "rest apis", "next.js",
    "design systems", "testing", "performance profiling", "python", "sql", "aws", "docker",
    "pandas", "numpy", "scikit-learn", "tableau", "power bi", "excel",
})

_KEYWORD_PATTERN_CACHE: dict[str, re.Pattern] = {}


def _keyword_pattern(keyword: str) -> re.Pattern:
    """Word-boundary match so short tokens ('ml', 'r', 'qa') don't hit as
    substrings of unrelated words ('html', 'or', 'square')."""
    pat = _KEYWORD_PATTERN_CACHE.get(keyword)
    if pat is None:
        pat = re.compile(rf"(?<![a-z0-9]){re.escape(keyword)}(?![a-z0-9])", re.I)
        _KEYWORD_PATTERN_CACHE[keyword] = pat
    return pat


def _count_hits(text: str, keywords: list[str]) -> int:
    return sum(1 for kw in keywords if _keyword_pattern(kw).search(text))


RESPONSIBILITY_VERBS = (
    "build", "design", "own", "lead", "develop", "implement", "collaborate", "manage",
    "create", "maintain", "present", "clean", "responsible", "drive", "partner", "mentor",
    "analyze", "deploy", "optimize", "write", "ship",
)

NICE_TO_HAVE_MARKERS = ("nice to have", "nice-to-have", "preferred", "bonus", "a plus", "good to have")


def _sentences(text: str) -> list[str]:
    """Split line-first, then by sentence punctuation within each line — a
    numbered/bulleted list stays as separate items instead of collapsing into
    one run-on sentence."""
    out = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        for part in re.split(r"(?<=[.!?])\s+", line):
            part = part.strip(" -•*\t")
            if part:
                out.append(part)
    return out


def _title_from(description: str) -> str:
    sents = _sentences(description)
    if not sents:
        return "Untitled role"
    first = sents[0]
    words = first.split()
    skip_starts = ("we ", "looking", "responsibilities", "requirements", "about", "the ", "our ")
    if len(words) <= 10 and not first.lower().startswith(skip_starts):
        return first.rstrip(".")
    return first.split(",")[0][:80].rstrip(".")


def _split_required_and_nice(description: str) -> tuple[str, str]:
    text = description.lower()
    for marker in NICE_TO_HAVE_MARKERS:
        idx = text.find(marker)
        if idx != -1:
            return description[:idx], description[idx:]
    return description, ""


def _list_items(text: str) -> list[str]:
    """Literal bullet/numbered list items ('1. Docker', '- Git') — read
    verbatim rather than matched against a closed skill vocabulary."""
    items = []
    for line in text.splitlines():
        m = re.match(r"^\s*(?:[-•*]|\d+[.)])\s+(.+)$", line)
        if m:
            item = m.group(1).strip().rstrip(".")
            if item:
                items.append(item)
    return items


SECTION_HEADERS = {"required skills", "requirements", "skills"} | set(NICE_TO_HAVE_MARKERS)


def _items_from_section(section: str) -> list[str]:
    """Bulleted/numbered items if present. Otherwise, only if the section
    opens with a recognized header line ('Nice to have:', 'Skills:', ...),
    treat the remaining lines as items — free-form prose with no structural
    signal returns [] so the caller falls back to a vocabulary scan."""
    items = _list_items(section)
    if items:
        return items

    lines = [l.strip(" :\t-") for l in section.splitlines() if l.strip()]
    if not lines or lines[0].lower().rstrip(":").strip() not in SECTION_HEADERS:
        return []
    lines = lines[1:]

    out = []
    for l in lines:
        out.extend(s.strip() for s in re.split(r"[,;]", l) if s.strip())
    return out


def _skills_in(text: str) -> list[str]:
    return [kw for kw in SKILL_VOCAB if _keyword_pattern(kw).search(text)]


def _skill_match(a: str, b: str) -> bool:
    """Fuzzy, whole-word match between two free-text skill strings so 'Git'
    matches a job requirement of 'Git version'."""
    a, b = a.lower().strip(), b.lower().strip()
    if a == b:
        return True
    shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
    if len(shorter) < 2:
        return False
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(shorter)}(?![a-z0-9])", longer))


# ---------- heuristic fallbacks (used when no API key, or a call fails) ----------

def _heuristic_parse_job(description: str) -> JobSpec:
    field: Field_ = "other"
    best = 0
    for f, kws in FIELD_KEYWORDS.items():
        hits = _count_hits(description, kws)
        if hits > best:
            best, field = hits, f

    seniority: Seniority = "mid"
    for s in ("principal", "lead", "senior", "junior", "intern"):
        if _keyword_pattern(s).search(description):
            seniority = s  # type: ignore[assignment]
            break

    years_match = re.search(r"(\d+)\+?\s*(?:to\s*\d+\s*)?(?:years|yrs)", description, re.I)
    min_years = float(years_match.group(1)) if years_match else 0.0

    required_text, nice_text = _split_required_and_nice(description)
    required = (_items_from_section(required_text) or _skills_in(required_text))[:10] or ["communication"]
    nice_raw = (_items_from_section(nice_text) or _skills_in(nice_text)) if nice_text else []
    nice_to_have = [s for s in nice_raw if not any(_skill_match(s, r) for r in required)][:10]

    title = _title_from(description)

    responsibilities = [
        s[:160] for s in _sentences(description)
        if any(v in s.lower() for v in RESPONSIBILITY_VERBS) and s != title
    ][:5]

    return JobSpec(
        title=title,
        field=field,
        seniority=seniority,
        min_years=min_years,
        required_skills=required,
        nice_to_have=nice_to_have,
        responsibilities=responsibilities,
    )


def _skills_section(text: str) -> list[str]:
    """Pull a labelled 'Skills:' block verbatim — bullets/numbers as list
    items, otherwise a comma/pipe-separated single line."""
    m = re.search(r"(?:^|\n)\s*(?:technical |key )?skills\s*[:\-]?\s*\n?(.*?)(?:\n\s*\n|\Z)", text, re.I | re.S)
    if not m:
        return []
    block = m.group(1)
    items = _list_items(block)
    if items:
        return items
    first_line = next((l for l in block.splitlines() if l.strip()), "")
    return [s.strip() for s in re.split(r"[,|/]", first_line) if s.strip()]


def _heuristic_parse_cv(text: str) -> CandidateProfile:
    email_m = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    name = None
    headline = ""
    for l in lines[:6]:
        if email_m and email_m.group(0) in l:
            continue
        if re.match(r"^\+?[\d\s().-]{7,}$", l):
            continue
        if not name and re.match(r"^[A-Z][a-zA-Z'-]+(\s+[A-Z][a-zA-Z'-]+){1,2}$", l):
            name = l
            continue
        if not headline and l != name:
            headline = l[:120]

    skills = list(dict.fromkeys(_skills_section(text) + _skills_in(text)))[:20]

    years_found = re.findall(r"(20\d{2})\s*[-–—]\s*(present|20\d{2})", text, re.I)
    experience = [
        ExperienceEntry(title="Role", company="Company", start=start, end=end.title(), description="")
        for start, end in years_found[:6]
    ]

    return CandidateProfile(
        full_name=name,
        email=email_m.group(0) if email_m else None,
        headline=headline or (lines[0][:120] if lines else ""),
        skills=skills,
        experience=experience,
    )


def _heuristic_classify(profile: CandidateProfile) -> FieldPrediction:
    text = " ".join(profile.skills + [profile.headline])
    best_field: Field_ = "other"
    best = 0
    for f, kws in FIELD_KEYWORDS.items():
        hits = _count_hits(text, kws)
        if hits > best:
            best, best_field = hits, f
    confidence = min(1.0, 0.4 + best * 0.12)
    return FieldPrediction(primary=best_field, confidence=confidence, rationale=f"{best} keyword matches")


def _heuristic_judge(profile: CandidateProfile, required: list[str], matched_required: list[str]) -> LLMJudgement:
    evidence_quality = min(5, 1 + len(profile.experience))
    skill_coverage = len(matched_required) / len(required) if required else 1.0
    responsibility_match = min(5, round(skill_coverage * 5))
    domain_relevance = min(5, 2 + len(matched_required) // 2)
    return LLMJudgement(
        evidence_quality=evidence_quality,
        evidence_quality_reason=f"{len(profile.experience)} experience entries with tracked date ranges.",
        domain_relevance=domain_relevance,
        domain_relevance_reason=f"{len(matched_required)} of {len(required)} required skills present.",
        responsibility_match=responsibility_match,
        responsibility_match_reason="Derived from required-skill coverage as a proxy.",
        concerns=[],
    )


def _relevant_years(profile: CandidateProfile, cap: float) -> float:
    total = 0.0
    for e in profile.experience:
        try:
            start = int((e.start or "0")[:4])
            end = 2026 if not e.end or "present" in e.end.lower() else int(e.end[:4])
            total += max(0, end - start)
        except ValueError:
            continue
    return min(total, cap) if cap else total


# ---------- Gemini-backed stages (with fallback) ----------
# Each returns (result, source) where source is "gemini" or "heuristic", so
# callers/endpoints can surface which one actually produced the output.

async def _parse_job(description: str) -> tuple[JobSpec, str]:
    if _client:
        try:
            prompt = (
                "Parse this job posting into structured fields.\n"
                "- required_skills and nice_to_have: the literal skill/tool names mentioned, "
                "exactly as written — don't invent, omit, or paraphrase them.\n"
                "- field: the single best-fitting category.\n"
                "- min_years: minimum years of experience explicitly stated, else 0.\n"
                "- responsibilities: 3-6 responsibility sentences, close to verbatim.\n\n"
                f"Job posting:\n{description}"
            )
            result = await _generate(MODEL_WORKHORSE, prompt, JobSpec)
            return result, "gemini"  # type: ignore[return-value]
        except Exception:
            logger.exception("Gemini parse_job failed, falling back to heuristic")
    return _heuristic_parse_job(description), "heuristic"


async def _parse_cv(text: str) -> tuple[CandidateProfile, str]:
    if _client:
        try:
            prompt = (
                "Extract a structured candidate profile from this CV text. "
                "List skills exactly as named in the CV (tools, languages, frameworks) — "
                "don't invent or normalize them away. Include experience start/end dates if present.\n\n"
                f"CV text:\n{text[:12000]}"
            )
            result = await _generate(MODEL_WORKHORSE, prompt, CandidateProfile)
            return result, "gemini"  # type: ignore[return-value]
        except Exception:
            logger.exception("Gemini parse_cv failed, falling back to heuristic")
    return _heuristic_parse_cv(text), "heuristic"


async def _classify(profile: CandidateProfile) -> tuple[FieldPrediction, str]:
    if _client:
        try:
            prompt = (
                "Classify this candidate into the single best-fitting engineering field, "
                "with a confidence 0-1 and a one-sentence rationale.\n\n"
                f"Headline: {profile.headline}\n"
                f"Skills: {', '.join(profile.skills) or 'none listed'}\n"
                f"Experience titles: {', '.join(e.title for e in profile.experience) or 'none listed'}"
            )
            result = await _generate(MODEL_CLASSIFY, prompt, FieldPrediction)
            return result, "gemini"  # type: ignore[return-value]
        except Exception:
            logger.exception("Gemini classify failed, falling back to heuristic")
    return _heuristic_classify(profile), "heuristic"


async def _judge(job: JobSpec, profile: CandidateProfile, matched_required: list[str], missing_required: list[str]) -> tuple[LLMJudgement, str]:
    if _client:
        try:
            experience_txt = "; ".join(
                f"{e.title} at {e.company} ({e.start}–{e.end}): {e.description}"
                for e in profile.experience
            ) or "none listed"
            prompt = (
                "Judge this candidate against the job on three axes, each 0-5, with a one-sentence "
                "reason anchored to the written scale:\n"
                "evidence_quality: 0=lists tools with no context, 3=describes real projects/responsibilities, "
                "5=quantified ownership and measurable impact.\n"
                "domain_relevance: 0=unrelated industry/product type, 5=same domain and scale, directly transferable.\n"
                "responsibility_match: how much of the job's listed responsibilities the candidate has demonstrably already done.\n"
                "concerns: factual, job-relevant only (unexplained multi-year gaps, claimed skills with no supporting "
                "experience, inconsistent dates) — never demographic. Empty list if none.\n\n"
                f"Job: {job.title} ({job.seniority})\n"
                f"Responsibilities: {'; '.join(job.responsibilities) or 'none listed'}\n"
                f"Matched required skills: {', '.join(matched_required) or 'none'}\n"
                f"Missing required skills: {', '.join(missing_required) or 'none'}\n\n"
                f"Candidate headline: {profile.headline}\n"
                f"Candidate skills: {', '.join(profile.skills) or 'none listed'}\n"
                f"Candidate experience: {experience_txt}"
            )
            result = await _generate(MODEL_WORKHORSE, prompt, LLMJudgement)
            return result, "gemini"  # type: ignore[return-value]
        except Exception:
            logger.exception("Gemini judge failed, falling back to heuristic")
    return _heuristic_judge(profile, matched_required + missing_required, matched_required), "heuristic"


class _ReviewNarrative(BaseModel):
    summary: str
    strengths: list[str]
    gaps_vs_job: list[str]
    suggested_edits: list[str]


async def _review_narrative(job: JobSpec, profile: CandidateProfile, breakdown: ScoreBreakdown) -> tuple[_ReviewNarrative, str]:
    if _client:
        try:
            prompt = (
                "Write human-facing feedback for HR reviewing this candidate against this job. "
                "Be concrete and specific to this candidate — reference their actual experience, not generic advice.\n\n"
                f"Job: {job.title} ({job.seniority}), required: {', '.join(job.required_skills)}\n"
                f"Score: {breakdown.total}/100. Matched required: {', '.join(breakdown.matched_required) or 'none'}. "
                f"Missing required: {', '.join(breakdown.missing_required) or 'none'}.\n\n"
                f"Candidate headline: {profile.headline}\n"
                f"Candidate skills: {', '.join(profile.skills) or 'none listed'}\n"
                f"Candidate experience: {'; '.join(f'{e.title} at {e.company}: {e.description}' for e in profile.experience) or 'none listed'}"
            )
            result = await _generate(MODEL_WORKHORSE, prompt, _ReviewNarrative)
            return result, "gemini"  # type: ignore[return-value]
        except Exception:
            logger.exception("Gemini review failed, falling back to heuristic")

    strengths = [f"Matches required skill: {s}" for s in breakdown.matched_required] or ["No strong keyword matches found."]
    gaps = [f"Missing required skill: {s}" for s in breakdown.missing_required]
    narrative = _ReviewNarrative(
        summary=f"Scored {breakdown.total}/100 against {job.title}.",
        strengths=strengths,
        gaps_vs_job=gaps,
        suggested_edits=["Add explicit years of experience per role."] if not profile.experience else [],
    )
    return narrative, "heuristic"


class _RerankOrder(BaseModel):
    ordered_candidate_ids: list[str]


async def _rerank(job: JobSpec, shortlist: list[ScoreBreakdown], candidates: dict[str, dict]) -> tuple[list[ScoreBreakdown], str]:
    """Gemini 3.1 Pro sees the whole shortlist side-by-side in one call and
    returns a relative order — per README, relative comparison is far more
    stable than independent absolute scoring."""
    if not _client or len(shortlist) < 2:
        return shortlist, "skipped"
    try:
        lines = []
        for s in shortlist:
            cv = candidates[s.candidate_id]
            profile = cv["profile"]
            lines.append(
                f"- id={s.candidate_id} | {profile.full_name or 'Unknown'} | score={s.total} | "
                f"matched={', '.join(s.matched_required) or 'none'} | missing={', '.join(s.missing_required) or 'none'} | "
                f"years={s.relevant_years} | evidence={s.judgement.evidence_quality}/5 | domain={s.judgement.domain_relevance}/5 | "
                f"responsibility={s.judgement.responsibility_match}/5"
            )
        prompt = (
            "Rank these candidates for this job from best to worst fit, seeing them side-by-side. "
            "Return every candidate_id exactly once, ordered best-first.\n\n"
            f"Job: {job.title} ({job.seniority}), required: {', '.join(job.required_skills)}\n"
            f"Responsibilities: {'; '.join(job.responsibilities) or 'none listed'}\n\n"
            "Candidates:\n" + "\n".join(lines)
        )
        order = await _generate(MODEL_RERANK, prompt, _RerankOrder)
        by_id = {s.candidate_id: s for s in shortlist}
        ordered = [by_id[cid] for cid in order.ordered_candidate_ids if cid in by_id]  # type: ignore[union-attr]
        remaining = [s for s in shortlist if s.candidate_id not in {o.candidate_id for o in ordered}]
        return ordered + remaining, "gemini"
    except Exception:
        logger.exception("Gemini rerank failed, keeping deterministic order")
        return shortlist, "heuristic"


async def _score(job: JobSpec, profile: CandidateProfile, cv: dict) -> tuple[ScoreBreakdown, str]:
    required = [s for s in job.required_skills if s.strip()]
    have = [s for s in profile.skills if s.strip()]
    matched_required = [r for r in required if any(_skill_match(r, h) for h in have)]
    missing_required = [r for r in required if r not in matched_required]
    skill_coverage = len(matched_required) / len(required) if required else 1.0

    nice = [s for s in job.nice_to_have if s.strip()]
    matched_nice = [n for n in nice if any(_skill_match(n, h) for h in have)]

    relevant_years = _relevant_years(profile, cap=job.min_years * 1.5 if job.min_years else 10)
    years_fit = min(1.0, relevant_years / job.min_years) if job.min_years else 1.0

    semantic_similarity = round(min(1.0, 0.3 + 0.1 * len(matched_required)), 2)

    judgement, judge_source = await _judge(job, profile, matched_required, missing_required)

    total = round(
        skill_coverage * 40
        + years_fit * 20
        + semantic_similarity * 10
        + (judgement.evidence_quality / 5) * 10
        + (judgement.domain_relevance / 5) * 10
        + (judgement.responsibility_match / 5) * 10,
        1,
    )

    breakdown = ScoreBreakdown(
        candidate_id=cv["file_hash"],
        skill_coverage=round(skill_coverage, 2),
        matched_required=matched_required,
        missing_required=missing_required,
        matched_nice=matched_nice,
        relevant_years=relevant_years,
        years_fit=round(years_fit, 2),
        semantic_similarity=semantic_similarity,
        judgement=judgement,
        total=total,
        injection_flag=cv["extracted"].injection_flag,
        parse_warnings=cv["extracted"].warnings,
    )
    return breakdown, judge_source


# ---------- endpoints ----------

@app.post("/jobs")
async def post_job(body: JobIn, db: AsyncSession = Depends(get_session)):
    description = body.description
    if not description.strip():
        raise HTTPException(400, "description is required")
    job, source = await _parse_job(description)
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    db.add(JobRow(job_id=job_id, field=job.field, spec=job.model_dump(), parse_source=source))
    await db.commit()
    return {"job_id": job_id, **job.model_dump(), "parse_source": source}


@app.get("/jobs")
async def list_jobs(db: AsyncSession = Depends(get_session)):
    """Not in README's original 5 endpoints — added so the frontend can offer
    a category picker instead of requiring a specific job id up front."""
    rows = (await db.execute(select(JobRow).order_by(JobRow.created_at.desc()))).scalars().all()
    counts = await _field_counts(db)
    return [
        {
            "job_id": row.job_id,
            **row.spec,
            "candidate_count": counts.get(row.field, 0),
            "parse_source": row.parse_source,
        }
        for row in rows
    ]


async def _ingest_one(f: UploadFile, tmp: Path) -> dict | None:
    dest = tmp / (f.filename or "upload")
    dest.write_bytes(await f.read())
    try:
        doc = extract(dest)
    except ValueError:
        return None

    # own session per task: an AsyncSession isn't safe to share across
    # concurrently-running coroutines in asyncio.gather.
    async with async_session() as db:
        existing = await db.get(CandidateRow, doc.file_hash)
        if existing is None:
            profile, parse_source = await _parse_cv(doc.text)
            prediction, classify_source = await _classify(profile)
            row = CandidateRow(
                file_hash=doc.file_hash,
                filename=f.filename or "upload",
                field=prediction.primary,
                profile=profile.model_dump(),
                extracted=doc.__dict__,
                parse_source=parse_source,
                classify_source=classify_source,
            )
            db.add(row)
            await db.commit()
            existing = row

    cv = _candidate_from_row(existing)
    return {
        "candidate_id": cv["file_hash"],
        "filename": f.filename,
        "full_name": cv["profile"].full_name,
        "field": cv["field"],
        "parse_source": cv["parse_source"],
        "classify_source": cv["classify_source"],
        "flagged": cv["extracted"].injection_flag,
    }


@app.post("/cvs")
async def post_cvs(files: list[UploadFile]):
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        results = await asyncio.gather(*(_ingest_one(f, tmp_path) for f in files))

    candidates = [r for r in results if r]
    flagged = sum(1 for r in candidates if r["flagged"])
    for r in candidates:
        del r["flagged"]
    return {"accepted": len(candidates), "flagged": flagged, "candidates": candidates}


@app.get("/fields")
async def get_fields(db: AsyncSession = Depends(get_session)):
    return await _field_counts(db)


@app.get("/jobs/{job_id}/ranking")
async def get_ranking(job_id: str, n: int = 10, field: str | None = None, db: AsyncSession = Depends(get_session)):
    job_row = await db.get(JobRow, job_id)
    if not job_row:
        raise HTTPException(404, "job not found")
    job = _job_from_row(job_row)

    query = select(CandidateRow)
    if field:
        query = query.where(CandidateRow.field == field)
    rows = (await db.execute(query)).scalars().all()
    pool = [_candidate_from_row(row) for row in rows]
    candidates_by_id = {cv["file_hash"]: cv for cv in pool}

    pool_key = frozenset(candidates_by_id)
    cache_key = (job_id, field, n)
    cached = RANKING_CACHE.get(cache_key)
    if cached and cached["pool_key"] == pool_key:
        return cached["response"]

    scored_pairs = await asyncio.gather(*(_score(job, cv["profile"], cv) for cv in pool))
    judge_source_by_id = {b.candidate_id: src for b, src in scored_pairs}
    scored = sorted((b for b, _ in scored_pairs), key=lambda s: s.total, reverse=True)

    # cheap score cuts the pile to ~2N, then one Pro call orders that
    # shortlist relatively — see README's "rank relatively, score absolutely"
    shortlist = scored[: max(n * 2, n)]
    reranked, rerank_source = await _rerank(job, shortlist, candidates_by_id)
    final = reranked[:n]

    results = []
    for s in final:
        cv = candidates_by_id[s.candidate_id]
        results.append({
            "candidate_id": s.candidate_id,
            "full_name": cv["profile"].full_name or "Unknown candidate",
            "headline": cv["profile"].headline,
            "total": s.total,
            "skill_coverage": s.skill_coverage,
            "matched_required": s.matched_required,
            "missing_required": s.missing_required,
            "relevant_years": s.relevant_years,
            "years_fit": s.years_fit,
            "judgement": s.judgement.model_dump(),
            "judge_source": judge_source_by_id[s.candidate_id],
            "parse_source": cv["parse_source"],
            "classify_source": cv["classify_source"],
            "injection_flag": s.injection_flag,
        })
    response = {
        "job_id": job_id,
        "job": {"job_id": job_id, **job.model_dump()},
        "rerank_source": rerank_source,
        "results": results,
    }
    RANKING_CACHE[cache_key] = {"pool_key": pool_key, "response": response}
    return response


@app.get("/cvs/{cv_id}/review")
async def get_review(cv_id: str, job_id: str, db: AsyncSession = Depends(get_session)):
    job_row = await db.get(JobRow, job_id)
    cv_row = await db.get(CandidateRow, cv_id)
    if not job_row or not cv_row:
        raise HTTPException(404, "job or candidate not found")
    job = _job_from_row(job_row)
    cv = _candidate_from_row(cv_row)

    breakdown, judge_source = await _score(job, cv["profile"], cv)
    narrative, review_source = await _review_narrative(job, cv["profile"], breakdown)

    review = CVReview(
        summary=narrative.summary,
        strengths=narrative.strengths,
        gaps_vs_job=narrative.gaps_vs_job,
        ats_formatting_issues=cv["extracted"].warnings,
        suggested_edits=narrative.suggested_edits,
    )
    return {
        "candidate_id": cv_id,
        "full_name": cv["profile"].full_name or "Unknown candidate",
        **review.model_dump(),
        "score_breakdown": breakdown.model_dump(),
        "parse_source": cv["parse_source"],
        "classify_source": cv["classify_source"],
        "judge_source": judge_source,
        "review_source": review_source,
    }
