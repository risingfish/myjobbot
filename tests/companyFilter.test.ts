import { expect, test } from "vitest";
import { isExcludedCompany, isExcludedPublisher } from "../src/jobs/companyFilter.js";

test("excluded companies match whole words, ignoring case and punctuation", () => {
  expect(isExcludedCompany("NVIDIA Corporation", ["nvidia"])).toBe(true);
  expect(isExcludedCompany("Coinbase, Inc.", ["Coinbase"])).toBe(true);
  expect(isExcludedCompany("The Home Depot", ["home depot"])).toBe(true);
});

test("excluded companies do not match inside longer words", () => {
  expect(isExcludedCompany("Nvidian Labs", ["nvidia"])).toBe(false);
  expect(isExcludedCompany("Depot Tools", ["home depot"])).toBe(false);
});

test("no excluded companies hides nothing", () => {
  expect(isExcludedCompany("Palantir", [])).toBe(false);
});

test("excluded publishers match whole words, ignoring case", () => {
  expect(isExcludedPublisher("DailyRemote", ["dailyremote"])).toBe(true);
  expect(isExcludedPublisher("Remote Quest Jobs", ["remote quest"])).toBe(true);
  expect(isExcludedPublisher("DailyRemote", ["remote"])).toBe(false);
});

test("a job with no publisher is never excluded", () => {
  expect(isExcludedPublisher(null, ["dailyremote"])).toBe(false);
});
