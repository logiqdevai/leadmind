/**
 * Typed from the TypeSafe System One docs (docs.typesafe.ai/api/system-one, /primitives/*). Jev returns typed answers with probabilities,
 * never prose - callers gate actions on `confidence` / the noul probability.
 */
export type JevStateItem =
  | string
  | { type: 'image_url'; image_url: { url: string } };

export type JevState = string | Record<string, unknown> | JevStateItem[];

export interface JevNoulQuestion {
  type: 'noul';
  instructions: string;
  criteria?: { true: string; false: string };
}

export interface JevChoiceQuestion {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string | null>;
}

export interface JevScoreQuestion {
  type: 'score';
  instructions: string;
  /** Ordered low -> high; the first item is level 0. */
  criteria: string[];
}

export type JevQuestion =
  | JevNoulQuestion
  | JevChoiceQuestion
  | JevScoreQuestion;

export interface JevNoulAnswer {
  type: 'noul';
  /** Probability of "yes", 0-1. Noul has no separate confidence. */
  noul: number;
}

export interface JevChoiceAnswer<T extends string = string> {
  type: 'choice';
  choice: T;
  confidence: number;
  probabilities: Record<T, number>;
}

export interface JevScoreAnswer {
  type: 'score';
  /** Probability-weighted level, 0 to (levels - 1). */
  score: number;
  confidence: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
}

export type JevAnswerFor<Q extends JevQuestion> = Q extends JevNoulQuestion
  ? JevNoulAnswer
  : Q extends JevChoiceQuestion
    ? JevChoiceAnswer
    : Q extends JevScoreQuestion
      ? JevScoreAnswer
      : never;

export interface JevUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface JevDecisionResponse<
  Q extends Record<string, JevQuestion> = Record<string, JevQuestion>,
> {
  /** The release that answered; may differ from the alias that was requested. */
  model: string;
  answers: { [K in keyof Q]: JevAnswerFor<Q[K]> };
  usage: JevUsage;
}
