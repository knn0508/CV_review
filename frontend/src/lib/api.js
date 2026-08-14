// Thin API client. Tries the real FastAPI backend first (proxied at /api ->
// http://localhost:8000 in dev, see vite.config.js); falls back to mock data
// when the backend isn't running yet, so the UI stays demoable.

import { FIELD_COUNTS, MOCK_JOB, MOCK_JOBS, MOCK_RANKING, MOCK_REVIEW } from "../data/mock";

async function tryFetch(path, options) {
  try {
    const res = await fetch(`/api${path}`, options);
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function createJob(description) {
  const real = await tryFetch("/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (real) return real;
  await delay(650);
  return { job_id: MOCK_JOB.id, ...MOCK_JOB, _mock: true };
}

export async function uploadCVs(files) {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const real = await tryFetch("/cvs", { method: "POST", body: form });
  if (real) return real;
  await delay(900 + files.length * 120);
  return {
    accepted: files.length,
    flagged: files.length > 5 ? 1 : 0,
    candidates: files.map((f, i) => ({
      candidate_id: `mock_${i}`,
      filename: f.name,
      full_name: null,
      field: MOCK_JOB.field,
      parse_source: "gemini",
      classify_source: "gemini",
    })),
    _mock: true,
  };
}

export async function listJobs() {
  const real = await tryFetch("/jobs");
  if (real) return real;
  await delay(250);
  return MOCK_JOBS;
}

export async function getFields() {
  const real = await tryFetch("/fields");
  if (real) return real;
  await delay(300);
  return { ...FIELD_COUNTS, _mock: true };
}

export async function getRanking(jobId, { n = 10, field } = {}) {
  const qs = new URLSearchParams({ n: String(n), ...(field ? { field } : {}) });
  const real = await tryFetch(`/jobs/${jobId}/ranking?${qs}`);
  if (real) return real;
  await delay(400);
  return { job: MOCK_JOB, results: MOCK_RANKING.slice(0, n), _mock: true };
}

export async function getReview(cvId, jobId) {
  const real = await tryFetch(`/cvs/${cvId}/review?job_id=${jobId}`);
  if (real) return real;
  await delay(500);
  return { ...MOCK_REVIEW, _mock: true };
}
