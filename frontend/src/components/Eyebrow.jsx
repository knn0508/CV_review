export default function Eyebrow({ children, tone = "default" }) {
  const tones = {
    default: "bg-[var(--color-ink)]/[0.06] text-[var(--color-ink-soft)]",
    warn: "bg-[#a03838]/10 text-[#a03838]",
    good: "bg-[#3a6e4a]/10 text-[#3a6e4a]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
