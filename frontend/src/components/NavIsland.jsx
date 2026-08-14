import { useState } from "react";
import { NavLink } from "react-router-dom";

const LINKS = [
  { to: "/", label: "Overview" },
  { to: "/jobs/new", label: "New Job" },
  { to: "/upload", label: "Upload CVs" },
  { to: "/ranking", label: "Ranking" },
];

export default function NavIsland() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="fixed top-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 md:w-max">
        <div className="flex items-center justify-between gap-6 rounded-full bg-[var(--color-canvas-raised)]/80 px-2 py-2 pl-5 shadow-[var(--shadow-float)] ring-1 ring-[var(--color-ink)]/[0.06] backdrop-blur-2xl">
          <span className="font-[var(--font-display)] text-sm font-semibold tracking-tight">Cortex</span>

          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-medium transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    isActive
                      ? "bg-[var(--color-ink)] text-[var(--color-canvas)]"
                      : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>

          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((o) => !o)}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)]/[0.05] md:hidden"
          >
            <span
              className="absolute h-[1.5px] w-4 bg-[var(--color-ink)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ transform: open ? "rotate(45deg)" : "translateY(-4px)" }}
            />
            <span
              className="absolute h-[1.5px] w-4 bg-[var(--color-ink)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ transform: open ? "rotate(-45deg)" : "translateY(4px)" }}
            />
          </button>
        </div>
      </nav>

      <div
        className={`fixed inset-0 z-40 bg-[var(--color-canvas)]/90 backdrop-blur-3xl transition-opacity duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] md:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex h-full flex-col items-center justify-center gap-4">
          {LINKS.map((l, i) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              onClick={() => setOpen(false)}
              className="font-[var(--font-display)] text-3xl font-medium transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{
                transitionDelay: open ? `${100 + i * 60}ms` : "0ms",
                transform: open ? "translateY(0)" : "translateY(48px)",
                opacity: open ? 1 : 0,
              }}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>
    </>
  );
}
