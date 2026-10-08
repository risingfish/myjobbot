import { hasWord, normalizeTitle } from "./normalize.js";

const MAX_SCORE = 100;

export type TitleBoosts = Record<string, number>;

export interface Boost {
  points: number;
  terms: string[];
}

/** Finds which configured boost terms appear in a job's text and totals the points they add. */
export function jobBoost(texts: Array<string | null>, boosts: TitleBoosts): Boost {
  const normalized = texts.map((text) => normalizeTitle(text ?? "")).join("\n");
  const matched = Object.entries(boosts).filter(([term]) => hasWord(normalized, term));
  return { points: matched.reduce((sum, [, points]) => sum + points, 0), terms: matched.map(([term]) => term) };
}

/** Adds a job's boost points to the model's score, capped at 100. */
export function boostedScore(score: number, boost: Boost): number {
  return Math.min(MAX_SCORE, score + boost.points);
}

/** Returns the points if every boost term matched, so the Recommended query keeps jobs boosts could still lift. */
export function maxBoost(boosts: TitleBoosts): number {
  return Object.values(boosts).reduce((sum, points) => sum + points, 0);
}
