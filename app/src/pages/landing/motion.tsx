import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useInView, usePrefersReducedMotion } from "./use-motion";

/* ─── Scroll reveal ───────────────────────────────────────────────────────── */

export function Reveal({ children, delay = 0, className = "", style }: { children?: ReactNode; delay?: number; className?: string; style?: CSSProperties }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  return (
    <div ref={ref} className={`lf-reveal${inView ? " lf-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

/* ─── Count up ────────────────────────────────────────────────────────────── */

interface CountUpProps {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  /** Start immediately on mount instead of waiting to scroll into view. */
  immediate?: boolean;
}

export function CountUp({ to, decimals = 0, prefix = "", suffix = "", duration = 1100, immediate = false }: CountUpProps) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLSpanElement>(0.5);
  const active = immediate || inView;
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!active || reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4); // ease-out-quart
      setVal(to * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduced, to, duration]);

  const shown = reduced ? (active ? to : 0) : val;
  return (
    <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  );
}
