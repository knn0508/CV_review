import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle, WarningCircle, MinusCircle } from "@phosphor-icons/react";
import { getReview } from "../lib/api";
import DoubleBezel from "../components/DoubleBezel";
import Eyebrow from "../components/Eyebrow";
import Reveal from "../components/Reveal";
import ScoreDial from "../components/ScoreDial";
import SourceBadge from "../components/SourceBadge";

export default function CandidateReview() {
  const { cvId } = useParams();
  const [params] = useSearchParams();
  const jobId = params.get("job_id");
  const [data, setData] = useState(null);

  useEffect(() => {
    getReview(cvId, jobId).then(setData);
  }, [cvId, jobId]);

  if (!data) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center px-4 pt-56">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-ink)]/15 border-t-[var(--color-ink)]" />
      </div>
    );
  }

  const b = data.score_breakdown;
  const j = b.judgement;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-40 md:px-8">
      <Reveal>
        <Eyebrow tone={b.injection_flag ? "warn" : "default"}>
          {b.injection_flag ? "Flagged for review" : "Candidate review"}
        </Eyebrow>
      </Reveal>

      <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <Reveal delay={80}>
          <h1 className="font-[var(--font-display)] text-4xl font-semibold tracking-tight md:text-5xl">
            {data.full_name}
          </h1>
          <p className="mt-3 max-w-xl text-[var(--color-ink-soft)]">{data.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SourceBadge source={data.parse_source} label="Parse" />
            <SourceBadge source={data.classify_source} label="Classify" />
            <SourceBadge source={data.judge_source} label="Judge" />
            <SourceBadge source={data.review_source} label="Review" />
          </div>
        </Reveal>
        <Reveal delay={140}>
          <ScoreDial value={b.total} size={88} label="Total" />
        </Reveal>
      </div>

      {b.injection_flag && (
        <Reveal delay={180} className="mt-8">
          <DoubleBezel innerClassName="bg-[#a03838]/[0.06]">
            <div className="flex items-center gap-3 p-5 text-sm text-[#a03838]">
              <WarningCircle size={18} weight="light" className="shrink-0" />
              Hidden or injected text was found in this document and quarantined before
              scoring. Review the source file directly before making a decision.
            </div>
          </DoubleBezel>
        </Reveal>
      )}

      <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-12">
        <Reveal className="md:col-span-7" delay={100}>
          <DoubleBezel className="h-full">
            <div className="p-7">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
                Deterministic score
              </span>
              <div className="mt-5 space-y-4">
                <Bar label="Skill coverage" value={b.skill_coverage} />
                <Bar label="Years fit" value={b.years_fit} sub={`${b.relevant_years} yrs relevant, capped to job minimum`} />
                <Bar label="Semantic similarity" value={b.semantic_similarity} sub="smoothing only, low weight" />
              </div>

              <div className="mt-7 grid grid-cols-2 gap-4 border-t border-[var(--color-line)] pt-6">
                <SkillList title="Matched required" items={b.matched_required} good />
                <SkillList title="Missing required" items={b.missing_required} good={false} />
                <SkillList title="Matched nice-to-have" items={b.matched_nice} good />
              </div>
            </div>
          </DoubleBezel>
        </Reveal>

        <Reveal className="md:col-span-5" delay={160}>
          <DoubleBezel className="h-full" innerClassName="bg-[var(--color-ink)] text-[var(--color-canvas)]">
            <div className="p-7">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                Model judgement · anchored 0–5
              </span>
              <div className="mt-5 space-y-5">
                <Axis label="Evidence quality" value={j.evidence_quality} reason={j.evidence_quality_reason} />
                <Axis label="Domain relevance" value={j.domain_relevance} reason={j.domain_relevance_reason} />
                <Axis label="Responsibility match" value={j.responsibility_match} reason={j.responsibility_match_reason} />
              </div>
              {j.concerns?.length > 0 && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">Concerns</span>
                  <ul className="mt-2 space-y-1.5">
                    {j.concerns.map((c) => (
                      <li key={c} className="text-sm text-white/70">{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </DoubleBezel>
        </Reveal>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Reveal delay={100}>
          <DoubleBezel className="h-full">
            <div className="p-7">
              <ListBlock icon={<CheckCircle size={16} weight="light" className="text-[#3a6e4a]" />} title="Strengths" items={data.strengths} />
              <div className="mt-6 border-t border-[var(--color-line)] pt-6">
                <ListBlock icon={<MinusCircle size={16} weight="light" className="text-[var(--color-ink-faint)]" />} title="Gaps vs. job" items={data.gaps_vs_job} />
              </div>
            </div>
          </DoubleBezel>
        </Reveal>

        <Reveal delay={160}>
          <DoubleBezel className="h-full">
            <div className="p-7">
              <ListBlock icon={<XCircle size={16} weight="light" className="text-[#a03838]" />} title="ATS formatting issues" items={data.ats_formatting_issues} />
              <div className="mt-6 border-t border-[var(--color-line)] pt-6">
                <ListBlock icon={<CheckCircle size={16} weight="light" className="text-[var(--color-ink-faint)]" />} title="Suggested edits" items={data.suggested_edits} />
              </div>
            </div>
          </DoubleBezel>
        </Reveal>
      </div>
    </div>
  );
}

function Bar({ label, value, sub }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm">{label}</span>
        <span className="font-mono text-xs tabular-nums text-[var(--color-ink-faint)]">{Math.round(value * 100)}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-ink)]/[0.06]">
        <div
          className="h-full rounded-full bg-[var(--color-ink)] transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      {sub && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{sub}</p>}
    </div>
  );
}

function Axis({ label, value, reason }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/85">{label}</span>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-1.5 w-4 rounded-full ${i < value ? "bg-white" : "bg-white/15"}`} />
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-white/50">{reason}</p>
    </div>
  );
}

function SkillList({ title, items, good }) {
  if (!items?.length) return <div />;
  return (
    <div>
      <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-ink-faint)]">{title}</span>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((s) => (
          <span
            key={s}
            className={`rounded-full px-2.5 py-1 text-xs ${
              good ? "bg-[#3a6e4a]/10 text-[#3a6e4a]" : "bg-[#a03838]/10 text-[#a03838]"
            }`}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function ListBlock({ icon, title, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-ink-faint)]">{title}</span>
      <ul className="mt-3 space-y-2.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2.5 text-sm leading-relaxed text-[var(--color-ink-soft)]">
            <span className="mt-0.5 shrink-0">{icon}</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
