import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkle, CheckCircle } from "@phosphor-icons/react";
import { createJob } from "../lib/api";
import DoubleBezel from "../components/DoubleBezel";
import Eyebrow from "../components/Eyebrow";
import Reveal from "../components/Reveal";
import { IslandButton } from "../components/Button";
import SourceBadge from "../components/SourceBadge";

export default function NewJob() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState(null);
  const navigate = useNavigate();

  async function handleParse() {
    if (!description.trim()) return;
    setLoading(true);
    const result = await createJob(description);
    setJob(result);
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-40 md:px-8">
      <Reveal>
        <Eyebrow>Step 1 of 3</Eyebrow>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="mt-6 font-[var(--font-display)] text-4xl font-semibold tracking-tight md:text-5xl">
          Post a job
        </h1>
      </Reveal>
      <Reveal delay={140}>
        <p className="mt-4 max-w-xl text-[var(--color-ink-soft)]">
          Paste the raw description. It's parsed once into a structured{" "}
          <code className="rounded bg-[var(--color-ink)]/[0.06] px-1.5 py-0.5 font-mono text-sm">JobSpec</code>{" "}
          and reused for every candidate — field, seniority, required and nice-to-have skills.
        </p>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Reveal delay={100}>
          <DoubleBezel>
            <div className="p-6">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Senior Frontend Engineer — we're looking for someone with 5+ years of React, TypeScript..."
                rows={16}
                className="w-full resize-none bg-transparent font-mono text-sm leading-relaxed text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] focus:outline-none"
              />
              <div className="mt-4 flex items-center justify-between border-t border-[var(--color-line)] pt-4">
                <span className="text-xs text-[var(--color-ink-faint)]">{description.length} chars</span>
                <IslandButton onClick={handleParse} disabled={loading || !description.trim()}>
                  {loading ? "Parsing…" : "Parse job spec"}
                </IslandButton>
              </div>
            </div>
          </DoubleBezel>
        </Reveal>

        <Reveal delay={180}>
          <DoubleBezel className="h-full" innerClassName="min-h-[420px]">
            <div className="p-6">
              {!job && !loading && (
                <div className="flex h-[360px] flex-col items-center justify-center gap-3 text-center text-[var(--color-ink-faint)]">
                  <Sparkle size={28} weight="light" />
                  <p className="max-w-[220px] text-sm">Parsed JobSpec appears here once you run it.</p>
                </div>
              )}
              {loading && (
                <div className="flex h-[360px] flex-col items-center justify-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-ink)]/15 border-t-[var(--color-ink)]" />
                  <p className="text-sm text-[var(--color-ink-faint)]">Extracting structure…</p>
                </div>
              )}
              {job && !loading && (
                <div className="animate-float-in space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[#3a6e4a]">
                      <CheckCircle size={18} weight="light" />
                      <span className="text-sm font-medium">Parsed</span>
                    </div>
                    <SourceBadge source={job.parse_source} />
                  </div>
                  <div>
                    <h3 className="font-[var(--font-display)] text-xl font-semibold">{job.title}</h3>
                    <div className="mt-1 flex gap-2 text-xs text-[var(--color-ink-faint)]">
                      <span className="capitalize">{job.field?.replace(/_/g, " ")}</span>
                      <span>·</span>
                      <span className="capitalize">{job.seniority}</span>
                      <span>·</span>
                      <span>{job.min_years}+ yrs</span>
                    </div>
                  </div>
                  <Spec label="Required skills" items={job.required_skills} />
                  <Spec label="Nice to have" items={job.nice_to_have} />
                  <Spec label="Responsibilities" items={job.responsibilities} />
                  <IslandButton
                    className="mt-2 w-full justify-center"
                    onClick={() => navigate(`/upload?job=${job.job_id ?? job.id}`)}
                  >
                    Continue to upload
                  </IslandButton>
                </div>
              )}
            </div>
          </DoubleBezel>
        </Reveal>
      </div>
    </div>
  );
}

function Spec({ label, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-ink-faint)]">{label}</span>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((s) => (
          <span key={s} className="rounded-full bg-[var(--color-ink)]/[0.05] px-2.5 py-1 text-xs">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
