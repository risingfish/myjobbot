import { expect, test } from "vitest";
import { passesTitleFilter } from "../src/jobs/titleFilter.js";

const FILTER = { include: ["engineer", "developer", "sre"], exclude: ["manager", "intern"] };

test("title filter accepts included titles", () => {
  expect(passesTitleFilter("Senior Software Engineer", FILTER)).toBe(true);
  expect(passesTitleFilter("SRE, Storage", FILTER)).toBe(true);
});

test("title filter matches word prefixes, not inner substrings", () => {
  expect(passesTitleFilter("Engineering Lead", FILTER)).toBe(true);
  expect(passesTitleFilter("Presales Consultant", FILTER)).toBe(false);
});

test("title filter rejects excluded titles", () => {
  expect(passesTitleFilter("Engineering Manager", FILTER)).toBe(false);
  expect(passesTitleFilter("Software Engineer Intern", FILTER)).toBe(false);
});

test("title filter excludes whole words only", () => {
  expect(passesTitleFilter("Internal Tools Engineer", FILTER)).toBe(true);
  expect(passesTitleFilter("International Payments Engineer", FILTER)).toBe(true);
  expect(passesTitleFilter("Software Engineer Interns", FILTER)).toBe(false);
});

test("title filter exclude does not match longer words", () => {
  const filter = { include: FILTER.include, exclude: ["sales"] };
  expect(passesTitleFilter("Salesforce Developer", filter)).toBe(true);
  expect(passesTitleFilter("Sales Engineer", filter)).toBe(false);
});

test("title filter rejects titles with no included term", () => {
  expect(passesTitleFilter("Account Executive", FILTER)).toBe(false);
});
