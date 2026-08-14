import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { WarningCircle, CaretRight, Briefcase } from "@phosphor-icons/react";
import { getRanking, listJobs } from "../lib/api";
import { FIELD_META } from "../lib/fields";
import DoubleBezel from "../components/DoubleBezel";
import Eyebrow from "../components/Eyebrow";
import Reveal from "../components/Reveal";
import ScoreDial from "../components/ScoreDial";
import SourceBadge from "../components/SourceBadge";

export default function Ranking() {
  const [params, setParams] = useSearchParams();
  const activeField = params.get("field");

  const [jobs, setJobs] = useState(null);
  const [data, setData] = useState(null);
  const [loadingRanking, setLoadingRanking] = useState(false);

  useEffect(() => {
    listJobs().then(setJobs);
  }, []);

  // pick the most recent job posted for the active category (jobs come newest-first)
  const job = jobs && activeField ? jobs.find((j) => j.field === activeField) : jobs?.[0];

  useEffect(() => {
    if (!jobs) return;
    if (!activeField && jobs[0]) {
      setParams({ field: jobs[0].field }, { replace: true });
      return;
    }
    if (!job) {
      setData(null);
      return;
    }
    setLoadingRanking(true);
    getRanking(job.job_id, { n: 12, field: job.field }).then((res) => {
      setData(res);
      setLoadingRanking(false);
    });
  }, [jobs, activeField, job?.job_id]);

  const categories = jobs
    ? [...new Map(jobs.map((j) => [j.field, j])).values()]
    : [];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-40 md:px-8">
      <Reveal>
        <Eyebrow>Ranked shortlists</Eyebrow>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="mt-6 font-[var(--font-display)] text-4xl font-semibold tracking-tight md:text-5xl">
          Ranking by category
        </h1>
      </Reveal>
      <Reveal delay={140}>
        <p className="mt-4 max-w-xl text-[var(--color-ink-soft)]">
          Each open vacancy ranks only the candidates auto-classified into its field.
          Pick a category to see its shortlist.
        </p>
      </Reveal>

      {jobs && jobs.length === 0 && (
        <Reveal delay={200} className="mt-14">
          <DoubleBezel>
            <div className="p-10 text-center text-[var(--color-ink-faint)]">
              No jobs posted yet.{" "}
              <Link to="/jobs/new" className="text-[var(--color-ink)] underline underline-offset-2">
                Post one
              </Link>{" "}
              to see rankings.
            </div>
          </DoubleBezel>
        </Reveal>
      )}

      {categories.length > 0 && (
        <Reveal delay={200} className="mt-10 flex flex-wrap gap-2">
          {categories.map((j) => {
            const meta = FIELD_META[j.field] ?? { label: j.field, color: "var(--color-ink-faint)" };
            const isActive = j.field === activeField;
            return (
              <button
                key={j.field}
                onClick={() => setParams({ field: j.field })}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                  isActive
                    ? "bg-[var(--color-ink)] text-[var(--color-canvas)]"
                    : "bg-[var(--color-ink)]/[0.05] text-[var(--color-ink-soft)] hover:bg-[var(--color-ink)]/10"
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: isActive ? "currentColor" : meta.color }}
                />
                {meta.label}
                <span className="text-xs opacity-60">{j.candidate_count}</span>
              </button>
            );
          })}
        </Reveal>
      )}

      {job && (
        <Reveal delay={240}>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-[var(--color-ink-faint)]">
            <span className="flex items-center gap-2">
              <Briefcase size={14} weight="light" />
              Ranking against <span className="text-[var(--color-ink)]">{job.title}</span>
            </span>
            <SourceBadge source={job.parse_source} label="Job parse" />
            <SourceBadge source={data?.rerank_source} label="Rerank" />
          </div>
        </Reveal>
      )}

      <div className="mt-8 space-y-3">
        {loadingRanking && (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-ink)]/15 border-t-[var(--color-ink)]" />
          </div>
        )}

        {!loadingRanking && data?.results?.length === 0 && (
          <DoubleBezel>
            <div className="p-10 text-center text-[var(--color-ink-faint)]">
              No candidates auto-classified into this category yet.
            </div>
          </DoubleBezel>
        )}

        {!loadingRanking &&
          data?.results?.map((c, i) => (
            <Reveal key={c.candidate_id} delay={i * 50}>
              <Link to={`/cvs/${c.candidate_id}/review?job_id=${job.job_id}`}>
                <DoubleBezel className="group transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5">
                  <div className="flex items-center gap-5 p-5 md:gap-8">
                    <span className="w-6 shrink-0 font-mono text-sm text-[var(--color-ink-faint)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <ScoreDial value={c.total} size={48} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-[var(--font-display)] text-base font-semibold">{c.full_name}</h3>
                        {c.injection_flag && (
                          <span title="Prompt-injection flagged">
                            <WarningCircle size={15} weight="light" className="shrink-0 text-[#a03838]" />
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-[var(--color-ink-soft)]">{c.headline}</p>
                    </div>

                    <SourceBadge source={c.judge_source} label="Judge" />

                    <div className="hidden shrink-0 items-center gap-6 text-center sm:flex">
                      <Metric label="Skill" value={`${Math.round(c.skill_coverage * 100)}%`} />
                      <Metric label="Years" value={c.relevant_years} />
                      <Metric label="Evidence" value={`${c.judgement.evidence_quality}/5`} />
                    </div>

                    <CaretRight
                      size={16}
                      weight="light"
                      className="shrink-0 text-[var(--color-ink-faint)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1"
                    />
                  </div>
                </DoubleBezel>
              </Link>
            </Reveal>
          ))}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="font-[var(--font-display)] text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-[0.15em] text-[var(--color-ink-faint)]">{label}</div>
    </div>
  );
}
