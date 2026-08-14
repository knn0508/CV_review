"""Scoring.

Design rule: anything that can be computed is computed. The model only supplies
the three qualitative axes. This is what makes rankings reproducible, cheap to
re-run with different weights, and defensible when a candidate asks why they
were rejected.
"""

from __future__ import annotations

import re
from datetime import date

import numpy as np
from pydantic import BaseModel, Field

from gemini import embed, structured, PRO
from schemas import CandidateProfile, JobSpec, LLMJudgement, ScoreBreakdown

SKILL_MATCH_THRESHOLD = 0.80   # cosine; catches React/React.js, Postgres/PostgreSQL

DEFAULT_WEIGHTS = {
    "skill_coverage": 0.35,
    "years_fit": 0.15,
    "evidence_quality": 0.20,
    "responsibility_match": 0.15,
    "domain_relevance": 0.10,
    "semantic_similarity": 0.05,   # noisy — smoothing only, never a driver
}


# ---------- deterministic: skills ----------

def _cos(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    a = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-9)
    b = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-9)
    return a @ b.T


def match_skills(candidate: list[str], required: list[str]
                 ) -> tuple[list[str], list[str]]:
    """Fuzzy set membership via embeddings. Exact string matching fails on the
    long tail of spellings; a keyword list you maintain by hand fails faster."""
    if not required:
        return [], []
    if not candidate:
        return [], list(required)

    vecs = np.array(embed(candidate + required))
    sim = _cos(vecs[:len(candidate)], vecs[len(candidate):])   # cand x req
    hit = sim.max(axis=0) >= SKILL_MATCH_THRESHOLD
    return ([r for r, h in zip(required, hit) if h],
            [r for r, h in zip(required, hit) if not h])


# ---------- deterministic: experience length ----------

_MONTH = re.compile(r"^(\d{4})(?:-(\d{1,2}))?$")


def _to_month(token: str | None, default: int | None = None) -> int | None:
    if not token:
        return default
    token = token.strip().lower()
    if token in ("present", "current", "now", "ongoing"):
        today = date.today()
        return today.year * 12 + today.month
    m = _MONTH.match(token)
    if not m:
        return default
    year, month = int(m.group(1)), int(m.group(2) or 1)
    return year * 12 + min(max(month, 1), 12)


def relevant_years(profile: CandidateProfile, job: JobSpec,
                   matched: list[str]) -> float:
    """Merge overlapping date ranges before summing — concurrent roles and
    freelance overlap otherwise inflate totals by years."""
    targets = {s.lower() for s in matched} | {job.field.replace("_", " ")}
    spans: list[tuple[int, int]] = []

    for e in profile.experience:
        haystack = f"{e.title} {e.description} {' '.join(e.tech)}".lower()
        if not any(t in haystack for t in targets):
            continue
        start = _to_month(e.start)
        end = _to_month(e.end, default=start)
        if start is None or end is None or end < start:
            continue
        spans.append((start, end))

    if not spans:
        return 0.0
    spans.sort()
    merged = [list(spans[0])]
    for s, e in spans[1:]:
        if s <= merged[-1][1] + 1:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    return round(sum(e - s for s, e in merged) / 12, 1)


def years_fit(years: float, min_years: float) -> float:
    """Capped at 1.0. Deliberately gives no credit for excess experience —
    an uncapped years term turns the ranking into an age proxy."""
    if min_years <= 0:
        return 1.0 if years > 0 else 0.5
    return min(years / min_years, 1.0)


# ---------- assembly ----------

def score(candidate_id: str, profile: CandidateProfile, job: JobSpec,
          judgement: LLMJudgement, cv_text: str, jd_text: str,
          weights: dict[str, float] | None = None,
          injection_flag: bool = False,
          parse_warnings: list[str] | None = None) -> ScoreBreakdown:
    w = {**DEFAULT_WEIGHTS, **(weights or {})}

    matched_req, missing_req = match_skills(profile.skills, job.required_skills)
    matched_nice, _ = match_skills(profile.skills, job.nice_to_have)

    coverage = len(matched_req) / len(job.required_skills) if job.required_skills else 1.0
    years = relevant_years(profile, job, matched_req + matched_nice)
    fit = years_fit(years, job.min_years)

    cv_vec, jd_vec = np.array(embed([cv_text[:20000], jd_text[:20000]]))
    semantic = float(np.clip(_cos(cv_vec[None, :], jd_vec[None, :])[0, 0], 0, 1))

    total = 100 * (
        w["skill_coverage"] * coverage
        + w["years_fit"] * fit
        + w["evidence_quality"] * judgement.evidence_quality / 5
        + w["responsibility_match"] * judgement.responsibility_match / 5
        + w["domain_relevance"] * judgement.domain_relevance / 5
        + w["semantic_similarity"] * semantic
    )

    return ScoreBreakdown(
        candidate_id=candidate_id,
        skill_coverage=round(coverage, 3),
        matched_required=matched_req,
        missing_required=missing_req,
        matched_nice=matched_nice,
        relevant_years=years,
        years_fit=round(fit, 3),
        semantic_similarity=round(semantic, 3),
        judgement=judgement,
        total=round(total, 1),
        injection_flag=injection_flag,
        parse_warnings=parse_warnings or [],
    )


# ---------- listwise re-rank ----------

class RankedItem(BaseModel):
    candidate_id: str
    rank: int
    reason: str = Field(description="One sentence, comparative, grounded in the CV")


class ReRanking(BaseModel):
    ranking: list[RankedItem]


def rerank_top(shortlist: list[ScoreBreakdown], job: JobSpec, n: int) -> ReRanking:
    """Absolute scores from independent calls drift; relative judgement is far
    more stable. So: use the cheap score to cut the pile to ~2N, then let Pro
    order that shortlist in a single call where it sees them side by side."""
    pool = sorted(shortlist, key=lambda s: s.total, reverse=True)[: max(2 * n, n + 5)]
    lines = "\n\n".join(
        f"[{s.candidate_id}] score {s.total} | {s.relevant_years}y relevant | "
        f"has: {', '.join(s.matched_required) or '—'} | "
        f"missing: {', '.join(s.missing_required) or '—'}\n"
        f"evidence: {s.judgement.evidence_quality_reason}\n"
        f"concerns: {'; '.join(s.judgement.concerns) or 'none'}"
        for s in pool
    )
    return structured(
        f"Rank these {len(pool)} shortlisted candidates for: {job.title} "
        f"({job.seniority}). Compare them against each other, not against an "
        "ideal. Weight demonstrated required skills and relevant depth above "
        "everything else. Rank every candidate exactly once.\n\n"
        f"{lines}",
        ReRanking,
        model=PRO,
    )
