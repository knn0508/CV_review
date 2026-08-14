"""Typed contracts. Every Gemini call returns one of these — no free-form text
anywhere in the pipeline except the human-facing review."""

from typing import Literal, Optional
from pydantic import BaseModel, Field

Field_ = Literal[
    "frontend", "backend", "fullstack", "mobile",
    "data_engineering", "data_science_ml", "devops_sre",
    "qa_testing", "security", "ui_ux_design",
    "product_project_management", "other",
]

Seniority = Literal["intern", "junior", "mid", "senior", "lead", "principal"]


# ---------- CV side ----------

class ExperienceEntry(BaseModel):
    title: str
    company: str
    start: Optional[str] = Field(None, description="YYYY-MM, or YYYY if only the year is given")
    end: Optional[str] = Field(None, description="YYYY-MM, YYYY, or 'present'")
    description: str = ""
    tech: list[str] = []


class EducationEntry(BaseModel):
    degree: str
    institution: str
    subject: str = ""
    end: Optional[str] = None


class CandidateProfile(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    links: list[str] = []
    headline: str = ""
    skills: list[str] = []
    experience: list[ExperienceEntry] = []
    education: list[EducationEntry] = []
    certifications: list[str] = []
    languages: list[str] = []


class FieldPrediction(BaseModel):
    primary: Field_
    confidence: float = Field(ge=0.0, le=1.0)
    secondary: Optional[Field_] = None
    rationale: str


# ---------- Job side ----------

class JobSpec(BaseModel):
    """Parsed once per job posting, reused for every candidate."""
    title: str
    field: Field_
    seniority: Seniority
    min_years: float = 0.0
    required_skills: list[str] = []
    nice_to_have: list[str] = []
    responsibilities: list[str] = []


# ---------- Scoring ----------

class LLMJudgement(BaseModel):
    """Only the parts a model is actually better at than code.
    Anchored 0-5 so scores stay comparable across separate calls."""
    evidence_quality: int = Field(ge=0, le=5, description=(
        "0 = lists tools with no context. 3 = describes real projects and "
        "responsibilities. 5 = quantified ownership and measurable impact."))
    evidence_quality_reason: str
    domain_relevance: int = Field(ge=0, le=5, description=(
        "0 = unrelated industry and product type. 5 = same domain, same scale, "
        "directly transferable."))
    domain_relevance_reason: str
    responsibility_match: int = Field(ge=0, le=5, description=(
        "How much of the job's listed responsibilities the candidate has "
        "demonstrably already done."))
    responsibility_match_reason: str
    concerns: list[str] = Field(default_factory=list, description=(
        "Factual, job-relevant only: unexplained multi-year gaps, claimed "
        "skills with no supporting experience, inconsistent dates. "
        "Never demographic."))


class ScoreBreakdown(BaseModel):
    candidate_id: str
    skill_coverage: float          # 0-1, deterministic
    matched_required: list[str]
    missing_required: list[str]
    matched_nice: list[str]
    relevant_years: float          # deterministic, from merged date ranges
    years_fit: float               # 0-1
    semantic_similarity: float     # 0-1, low weight — smoothing only
    judgement: LLMJudgement
    total: float                   # 0-100
    injection_flag: bool = False
    parse_warnings: list[str] = []


class CVReview(BaseModel):
    """Human-facing feedback. Separate call, separate concern from scoring."""
    summary: str
    strengths: list[str]
    gaps_vs_job: list[str]
    ats_formatting_issues: list[str]
    suggested_edits: list[str]
