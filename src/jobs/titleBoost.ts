import { hasWord, normalizeTitle } from "./normalize.js";

const MAX_SCORE = 100;

export type TitleBoosts = Record<string, number>;

export interface Boost {
  points: number;
  terms: string[];
}

export function titleBoost(title: string, boosts: TitleBoosts): Boost {
  const normalized = normalizeTitle(title);
  const matched = Object.entries(boosts).filter(([term]) => hasWord(normalized, term));
  return { points: matched.reduce((sum, [, points]) => sum + points, 0), terms: matched.map(([term]) => term) };
}

export function boostedScore(score: number, boost: Boost): number {
  return Math.min(MAX_SCORE, score + boost.points);
}

export function maxBoost(boosts: TitleBoosts): number {
  return Object.values(boosts).reduce((sum, points) => sum + points, 0);
}
