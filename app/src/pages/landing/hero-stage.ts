import { useEffect, useState } from "react";
import { Search, Send, Sparkles, type LucideIcon } from "lucide-react";
import { usePrefersReducedMotion } from "./use-motion";

export const STAGE_MS = 4200;

export const STAGES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "find", label: "Find", icon: Search },
  { key: "score", label: "Score", icon: Sparkles },
  { key: "reach", label: "Reach out", icon: Send },
];

interface StageState {
  stage: number;
  /** Bumps on every change so CSS progress animations restart. */
  tick: number;
  /** Bumps each time the loop returns to stage 0 so rows re-enter. */
  cycle: number;
}

export type HeroStage = StageState & { go: (stage: number) => void };

function advance(s: StageState, stage: number): StageState {
  return { stage, tick: s.tick + 1, cycle: stage === 0 ? s.cycle + 1 : s.cycle };
}

/** Looping Find → Score → Reach out state, shared by the headline and the hero card. */
export function useHeroStage(): HeroStage {
  const reduced = usePrefersReducedMotion();
  const [state, setState] = useState<StageState>(() => ({ stage: reduced ? 1 : 0, tick: 0, cycle: 0 }));

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setState((s) => advance(s, (s.stage + 1) % STAGES.length)), STAGE_MS);
    return () => clearTimeout(t);
  }, [state, reduced]);

  const go = (stage: number) => setState((s) => advance(s, stage));
  return { ...state, go };
}
