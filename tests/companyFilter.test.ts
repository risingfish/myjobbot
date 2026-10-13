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

const OTHER_LINK = "https://www.example.com/j";
const JOBMESH_LINK = "https://jobmesh.io/job/1";

test("excluded publishers match whole words, ignoring case", () => {
  expect(isExcludedPublisher({ publisher: "DailyRemote", url: OTHER_LINK }, ["dailyremote"])).toBe(true);
  expect(isExcludedPublisher({ publisher: "Remote Quest Jobs", url: OTHER_LINK }, ["remote quest"])).toBe(true);
  expect(isExcludedPublisher({ publisher: "DailyRemote", url: OTHER_LINK }, ["remote"])).toBe(false);
});

test("a job with no publisher is never excluded by name", () => {
  expect(isExcludedPublisher({ publisher: null, url: OTHER_LINK }, ["dailyremote"])).toBe(false);
});

test("name entries match only the publisher and domain entries only the apply link", () => {
  expect(isExcludedPublisher({ publisher: "DailyRemote", url: OTHER_LINK }, ["dailyremote", "*.trabajo.org"])).toBe(true);
  expect(isExcludedPublisher({ publisher: "Trabajo.org", url: OTHER_LINK }, ["trabajo.org"])).toBe(false);
  expect(isExcludedPublisher({ publisher: "LinkedIn", url: "https://www.linkedin.com/jobs/view/1" }, ["dailyremote", "jobmesh.io"])).toBe(false);
  expect(isExcludedPublisher({ publisher: "Remote.co", url: OTHER_LINK }, ["remote.co"])).toBe(false);
});

test("a domain entry excludes by apply link, whatever the publisher is called", () => {
  expect(isExcludedPublisher({ publisher: "JobMESH", url: JOBMESH_LINK }, ["jobmesh.io"])).toBe(true);
  expect(isExcludedPublisher({ publisher: null, url: JOBMESH_LINK }, ["jobmesh.io"])).toBe(true);
});
