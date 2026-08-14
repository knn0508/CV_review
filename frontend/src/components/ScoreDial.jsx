// Circular tabular-nums score readout, drawn with a conic-gradient ring —
// no chart library needed for a single value.
export default function ScoreDial({ value, size = 56, label }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(var(--color-ink) ${pct * 3.6}deg, var(--color-ink)/10deg, transparent 0deg)`,
        }}
      >
        <div
          className="absolute rounded-full"
          style={{
            inset: 3,
            background: "conic-gradient(var(--color-ink) calc(var(--p) * 3.6deg), rgba(20,20,15,0.08) 0deg)",
            "--p": pct,
          }}
        />
        <div
          className="absolute rounded-full bg-[var(--color-canvas-raised)] flex items-center justify-center"
          style={{ inset: 6 }}
        >
          <span className="font-[var(--font-display)] text-sm font-semibold tabular-nums">{Math.round(pct)}</span>
        </div>
      </div>
      {label && <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-ink-faint)]">{label}</span>}
    </div>
  );
}
