import { expect, test } from "vitest";
import { normalizeTitle } from "../src/jobs/normalize.js";

test("normalizeTitle lowercases and strips punctuation", () => {
  expect(normalizeTitle("Sr. Software Engineer, Backend")).toBe("sr software engineer backend");
});

test("normalizeTitle collapses whitespace", () => {
  expect(normalizeTitle("  Staff   Engineer  ")).toBe("staff engineer");
});
