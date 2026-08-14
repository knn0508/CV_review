import { ArrowUpRight } from "@phosphor-icons/react";

export function IslandButton({ children, icon = true, variant = "primary", className = "", ...props }) {
  const variants = {
    primary: "bg-[var(--color-ink)] text-[var(--color-canvas)]",
    ghost: "bg-transparent text-[var(--color-ink)] ring-1 ring-[var(--color-ink)]/10",
  };
  return (
    <button
      className={`group inline-flex items-center gap-3 rounded-full py-1.5 pl-6 pr-1.5 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:pl-7 hover:pr-1 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...props}
    >
      <span>{children}</span>
      {icon && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
          <ArrowUpRight size={14} weight="light" />
        </span>
      )}
    </button>
  );
}
