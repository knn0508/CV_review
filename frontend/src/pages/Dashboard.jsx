import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UsersThree, FileText, ShieldWarning, ArrowRight } from "@phosphor-icons/react";
import { getFields } from "../lib/api";
import { FIELD_META } from "../lib/fields";
import DoubleBezel from "../components/DoubleBezel";
import Eyebrow from "../components/Eyebrow";
import Reveal from "../components/Reveal";
import { IslandButton } from "../components/Button";

export default function Dashboard() {
  const [fields, setFields] = useState(null);

  useEffect(() => {
    getFields().then(setFields);
  }, []);

  const total = fields ? Object.entries(fields).filter(([k]) => k !== "_mock").reduce((s, [, v]) => s + v, 0) : 0;
  const topFields = fields
    ? Object.entries(fields)
        .filter(([k]) => k !== "_mock")
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-40 md:px-8">
      <Reveal>
        <Eyebrow>Auditable ranking · EU AI Act ready</Eyebrow>
      </Reveal>

      <Reveal delay={80}>
        <h1 className="mt-6 max-w-3xl font-[var(--font-display)] text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          Screen the pile. Explain every number.
        </h1>
      </Reveal>

      <Reveal delay={160}>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--color-ink-soft)]">
          Skill coverage and years are computed, not guessed. The model only judges what a
          model is actually better at — evidence quality, domain relevance, responsibility
          match — on a written, anchored scale.
        </p>
      </Reveal>

      <Reveal delay={240}>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link to="/jobs/new">
            <IslandButton>Post a job</IslandButton>
          </Link>
          <Link to="/upload">
            <IslandButton variant="ghost" icon={false}>
              Upload CVs
            </IslandButton>
          </Link>
        </div>
      </Reveal>

      <div className="mt-24 grid grid-cols-1 gap-5 md:grid-cols-12">
        <Reveal className="md:col-span-7" delay={100}>
          <DoubleBezel className="h-full">
            <div className="flex h-full flex-col justify-between p-8">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
                    Pipeline
                  </span>
                  <h2 className="mt-2 font-[var(--font-display)] text-2xl font-semibold">
                    {total || "—"} candidates in the pile
                  </h2>
                </div>
                <UsersThree size={28} weight="light" className="text-[var(--color-ink-faint)]" />
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-3 text-sm text-[var(--color-ink-soft)]">
                {["upload", "extract", "parse", "classify", "score", "rerank"].map((step, i, arr) => (
                  <span key={step} className="flex items-center gap-2">
                    <span className="rounded-full bg-[var(--color-ink)]/[0.05] px-3 py-1.5 font-mono text-xs">
                      {step}
                    </span>
                    {i < arr.length - 1 && <ArrowRight size={12} weight="light" className="text-[var(--color-ink-faint)]" />}
                  </span>
                ))}
              </div>
            </div>
          </DoubleBezel>
        </Reveal>

        <Reveal className="md:col-span-5" delay={180}>
          <DoubleBezel className="h-full" innerClassName="bg-[var(--color-ink)] text-[var(--color-canvas)]">
            <div className="flex h-full flex-col justify-between p-8">
              <div className="flex items-start justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">Fairness</span>
                <ShieldWarning size={28} weight="light" className="text-white/60" />
              </div>
              <div className="mt-10">
                <p className="text-sm leading-relaxed text-white/70">
                  Scoring runs on a redacted copy — name, email, phone, and
                  demographic markers are stripped before the model ever sees the CV.
                </p>
                <p className="mt-4 font-[var(--font-display)] text-lg font-medium">Years capped at job minimum</p>
                <p className="text-xs text-white/50">extra tenure earns nothing — no age proxy</p>
              </div>
            </div>
          </DoubleBezel>
        </Reveal>

        {topFields.map(([key, count], i) => {
          const meta = FIELD_META[key] ?? { label: key, color: "var(--color-ink-faint)" };
          return (
            <Reveal key={key} className="md:col-span-4" delay={260 + i * 40}>
              <Link to={`/ranking?field=${key}`}>
                <DoubleBezel className="group h-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1">
                  <div className="flex h-full flex-col justify-between p-6">
                    <div className="flex items-center justify-between">
                      <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                      <ArrowRight
                        size={14}
                        weight="light"
                        className="text-[var(--color-ink-faint)] opacity-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 group-hover:opacity-100"
                      />
                    </div>
                    <div className="mt-8">
                      <div className="font-[var(--font-display)] text-3xl font-semibold tabular-nums">{count}</div>
                      <div className="mt-1 text-sm text-[var(--color-ink-soft)]">{meta.label}</div>
                    </div>
                  </div>
                </DoubleBezel>
              </Link>
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={100} className="mt-20">
        <DoubleBezel>
          <div className="flex flex-col items-start gap-6 p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <FileText size={22} weight="light" className="text-[var(--color-ink-faint)]" />
              <p className="text-sm text-[var(--color-ink-soft)]">
                Hidden-text and prompt-injection spans are quarantined before scoring and
                surfaced here for review — never silently discarded.
              </p>
            </div>
            <Link to="/upload">
              <IslandButton variant="ghost" icon={false} className="whitespace-nowrap">
                Review flags
              </IslandButton>
            </Link>
          </div>
        </DoubleBezel>
      </Reveal>
    </div>
  );
}
