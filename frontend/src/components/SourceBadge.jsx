import { Sparkle, Cpu } from "@phosphor-icons/react";

const STYLES = {
  gemini: { label: "Gemini", icon: Sparkle, className: "bg-[#3a6e4a]/10 text-[#3a6e4a]" },
  heuristic: { label: "Heuristic", icon: Cpu, className: "bg-[var(--color-ink)]/[0.06] text-[var(--color-ink-faint)]" },
  skipped: { label: "Skipped", icon: Cpu, className: "bg-[var(--color-ink)]/[0.06] text-[var(--color-ink-faint)]" },
};

export default function SourceBadge({ source, label }) {
  if (!source) return null;
  const style = STYLES[source] ?? STYLES.heuristic;
  const Icon = style.icon;
  return (
    <span
      title={source === "heuristic" ? "Gemini unavailable or quota-exhausted — used the keyword/regex fallback" : "Answered by the Gemini model"}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${style.className}`}
    >
      <Icon size={10} weight="fill" />
      {label ? `${label} · ${style.label}` : style.label}
    </span>
  );
}
