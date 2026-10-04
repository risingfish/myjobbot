import { expect, test } from "vitest";
import { normalizeCompany } from "../src/jobs/company.js";

test("normalizeCompany drops punctuation and legal suffixes", () => {
  expect(normalizeCompany("Stripe, Inc.")).toBe("stripe");
  expect(normalizeCompany("Acme Robotics LLC")).toBe("acme robotics");
  expect(normalizeCompany("Foo Corp.")).toBe("foo");
});

test("normalizeCompany keeps a name that is only a suffix word", () => {
  expect(normalizeCompany("Co")).toBe("co");
});
