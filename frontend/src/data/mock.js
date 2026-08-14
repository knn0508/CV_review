// Realistic mock data shaped exactly like schemas.py, used until the FastAPI
// backend (app/main.py) exists. api.js swaps these for fetch() calls when a
// real endpoint responds.

export const FIELD_LABELS = {
  frontend: "Frontend",
  backend: "Backend",
  fullstack: "Fullstack",
  mobile: "Mobile",
  data_engineering: "Data Engineering",
  data_science_ml: "Data Science / ML",
  devops_sre: "DevOps / SRE",
  qa_testing: "QA / Testing",
  security: "Security",
  ui_ux_design: "UI/UX Design",
  product_project_management: "Product / PM",
  other: "Other",
};

export const FIELD_COUNTS = {
  frontend: 34,
  backend: 41,
  fullstack: 19,
  mobile: 12,
  data_engineering: 8,
  data_science_ml: 15,
  devops_sre: 11,
  qa_testing: 9,
  security: 4,
  ui_ux_design: 6,
  product_project_management: 7,
  other: 3,
};

export const MOCK_JOB = {
  id: "job_8f21ac",
  job_id: "job_8f21ac",
  parse_source: "gemini",
  title: "Senior Frontend Engineer",
  field: "frontend",
  seniority: "senior",
  min_years: 5,
  required_skills: ["React", "TypeScript", "CSS architecture", "Accessibility (WCAG 2.1)", "REST APIs"],
  nice_to_have: ["Next.js", "Design systems", "Testing (Playwright/Vitest)", "Performance profiling"],
  responsibilities: [
    "Own frontend architecture for the candidate-facing portal",
    "Partner with design on a component library used across 3 product surfaces",
    "Mentor two mid-level engineers",
    "Drive Core Web Vitals and accessibility compliance",
  ],
};

export const MOCK_JOBS = [
  { ...MOCK_JOB, candidate_count: 34 },
  {
    job_id: "job_4c19be",
    parse_source: "gemini",
    title: "Junior Data Scientist",
    field: "data_science_ml",
    seniority: "junior",
    min_years: 1,
    required_skills: ["Python", "SQL", "Pandas", "Machine Learning"],
    nice_to_have: ["Scikit-learn", "Deep Learning", "Statistics"],
    responsibilities: ["Build predictive models", "Clean datasets", "Present insights to stakeholders"],
    candidate_count: 15,
  },
  {
    job_id: "job_9a72dd",
    parse_source: "heuristic",
    title: "DevOps Engineer",
    field: "devops_sre",
    seniority: "mid",
    min_years: 3,
    required_skills: ["Kubernetes", "Terraform", "AWS", "CI/CD"],
    nice_to_have: ["Docker", "Prometheus"],
    responsibilities: ["Own deployment pipelines", "Manage cloud infrastructure"],
    candidate_count: 11,
  },
];

const names = [
  "Amara Osei", "Liu Wen", "Sofía Reyes", "Kenji Watanabe", "Priya Nair",
  "Tomasz Kowalski", "Fatima Al-Sayed", "Nora Lindqvist", "Diego Fernández",
  "Elena Popescu", "Malik Johnson", "Yuki Tanaka",
];

function seededScore(seed, base) {
  const x = Math.sin(seed * 999.7) * 10000;
  return base + ((x - Math.floor(x)) - 0.5) * 12;
}

export const MOCK_RANKING = names.map((full_name, i) => {
  const total = Math.max(38, Math.min(96, Math.round(seededScore(i + 1, 82 - i * 3.4))));
  const skill_coverage = Math.min(1, Math.max(0.2, (total - 10) / 100));
  const relevant_years = Math.max(0.5, Math.round((6 - i * 0.35) * 10) / 10);
  return {
    candidate_id: `cand_${(1000 + i).toString(16)}`,
    full_name,
    headline: [
      "Frontend engineer, design-systems focus",
      "Fullstack leaning frontend, ex-fintech",
      "React/TS specialist, 6y product work",
      "Frontend + a11y advocate",
      "Platform-leaning frontend engineer",
    ][i % 5],
    total,
    skill_coverage,
    matched_required: ["React", "TypeScript", "REST APIs"].slice(0, 3 - (i % 3)),
    missing_required: i % 3 === 0 ? [] : ["Accessibility (WCAG 2.1)"],
    relevant_years,
    years_fit: Math.min(1, relevant_years / MOCK_JOB.min_years),
    judgement: {
      evidence_quality: Math.max(1, 5 - Math.floor(i / 3)),
      domain_relevance: Math.max(1, 4 - Math.floor(i / 4)),
      responsibility_match: Math.max(1, 5 - Math.floor(i / 2.5)),
    },
    injection_flag: i === 7,
    parse_source: "gemini",
    classify_source: "gemini",
    judge_source: i % 4 === 0 ? "heuristic" : "gemini",
  };
}).sort((a, b) => b.total - a.total);

export const MOCK_REVIEW = {
  candidate_id: "cand_1000",
  full_name: "Amara Osei",
  parse_source: "gemini",
  classify_source: "gemini",
  judge_source: "gemini",
  review_source: "gemini",
  summary:
    "Strong match on core stack and architecture ownership; less evidence of accessibility work at the depth the role wants.",
  strengths: [
    "Led a component library rollout across two product teams — same shape as this role's first deliverable",
    "Quantified impact: cut bundle size 38%, LCP from 3.1s to 1.6s",
    "Mentored two junior engineers over 18 months",
  ],
  gaps_vs_job: [
    "No explicit WCAG/accessibility audit experience mentioned",
    "Limited backend/API design exposure — role expects some REST contract input",
  ],
  ats_formatting_issues: [
    "Two-column layout may parse out of order in some ATS systems",
    "Dates on experience entries use inconsistent formats (MM/YYYY vs 'Spring 2022')",
  ],
  suggested_edits: [
    "Add a line quantifying accessibility work, even informal (Lighthouse scores, manual audits)",
    "Normalize date formats across all experience entries",
  ],
  score_breakdown: {
    skill_coverage: 0.86,
    matched_required: ["React", "TypeScript", "CSS architecture"],
    missing_required: ["Accessibility (WCAG 2.1)"],
    matched_nice: ["Next.js", "Design systems"],
    relevant_years: 6.2,
    years_fit: 1.0,
    semantic_similarity: 0.71,
    judgement: {
      evidence_quality: 5,
      evidence_quality_reason: "Quantified ownership across two shipped systems with measurable metrics.",
      domain_relevance: 4,
      domain_relevance_reason: "Consumer product, similar scale, directly transferable component patterns.",
      responsibility_match: 4,
      responsibility_match_reason: "Has owned architecture and mentored, no direct evidence of cross-surface design-system work at this scope.",
      concerns: [],
    },
    total: 88,
    injection_flag: false,
    parse_warnings: [],
  },
};
