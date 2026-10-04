import { expect, test } from "vitest";
import { boostedScore, maxBoost, titleBoost } from "../src/jobs/titleBoost.js";

const BOOSTS = { typescript: 10, node: 5, vue: 8 };

test("title boost adds the points of every term in the title", () => {
  expect(titleBoost("Senior TypeScript Engineer (Node)", BOOSTS)).toEqual({ points: 15, terms: ["typescript", "node"] });
});

test("title boost matches whole words only", () => {
  expect(titleBoost("Nodejs Engineer", BOOSTS).points).toBe(0);
  expect(titleBoost("Vuetify Developer", BOOSTS).points).toBe(0);
  expect(titleBoost("Node Engineer", BOOSTS).points).toBe(5);
});

test("a boosted score never exceeds 100", () => {
  expect(boostedScore(95, { points: 15, terms: ["typescript", "node"] })).toBe(100);
  expect(boostedScore(60, { points: 15, terms: ["typescript", "node"] })).toBe(75);
});

test("max boost is every term matching at once", () => {
  expect(maxBoost(BOOSTS)).toBe(23);
  expect(maxBoost({})).toBe(0);
});
