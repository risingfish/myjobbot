import { expect, test } from "vitest";
import { boostedScore, jobBoost, maxBoost } from "../src/jobs/titleBoost.js";

const BOOSTS = { typescript: 10, node: 5, vue: 8 };

test("boost adds the points of every term in the title", () => {
  expect(jobBoost(["Senior TypeScript Engineer (Node)"], BOOSTS)).toEqual({ points: 15, terms: ["typescript", "node"] });
});

test("boost matches whole words only", () => {
  expect(jobBoost(["Nodejs Engineer"], BOOSTS).points).toBe(0);
  expect(jobBoost(["Vuetify Developer"], BOOSTS).points).toBe(0);
  expect(jobBoost(["Node Engineer"], BOOSTS).points).toBe(5);
});

test("a boosted score never exceeds 100", () => {
  expect(boostedScore(95, { points: 15, terms: ["typescript", "node"] })).toBe(100);
  expect(boostedScore(60, { points: 15, terms: ["typescript", "node"] })).toBe(75);
});

test("max boost is every term matching at once", () => {
  expect(maxBoost(BOOSTS)).toBe(23);
  expect(maxBoost({})).toBe(0);
});

test("boosts also match the description, counting each term once", () => {
  const boost = jobBoost(["Senior Engineer", "You will build Vue apps with TypeScript. TypeScript everywhere."], BOOSTS);
  expect(boost).toEqual({ points: 18, terms: ["typescript", "vue"] });
  expect(jobBoost(["TypeScript Engineer", "Mostly TypeScript."], BOOSTS).points).toBe(10);
});

test("a missing description adds nothing", () => {
  expect(jobBoost(["Senior Engineer", null], BOOSTS).points).toBe(0);
});
