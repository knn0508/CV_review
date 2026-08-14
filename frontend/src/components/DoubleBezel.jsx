// Nested "machined hardware" card: outer shell (tray) + inner core (glass
// plate), concentric radii. Use for every elevated surface in the app.
export default function DoubleBezel({ children, className = "", innerClassName = "", padding = "p-1.5" }) {
  return (
    <div className={`rounded-[2rem] bg-[var(--color-ink)]/[0.035] ring-1 ring-[var(--color-ink)]/[0.06] ${padding} ${className}`}>
      <div
        className={`rounded-[calc(2rem-0.375rem)] bg-[var(--color-canvas-raised)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] ring-1 ring-[var(--color-ink)]/[0.04] ${innerClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
