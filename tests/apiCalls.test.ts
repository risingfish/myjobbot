import { expect, test } from "vitest";
import { ApiCallLog } from "../src/db/apiCalls.js";
import { openDatabase } from "../src/db/open.js";

function seededCalls(): ApiCallLog {
  const calls = new ApiCallLog(openDatabase(":memory:"));
  calls.record("jsearch", "A", "2026-09-30T23:00:00.000Z");
  calls.record("jsearch", "A", "2026-10-02T10:00:00.000Z");
  calls.record("jsearch", "B", "2026-10-03T10:00:00.000Z");
  return calls;
}

test("ApiCallLog counts calls since a time and finds each source's last call", () => {
  const calls = seededCalls();
  expect(calls.countSince("jsearch", "2026-10-01T00:00:00.000Z")).toBe(2);
  expect(calls.lastCallAt("jsearch", "A")).toBe("2026-10-02T10:00:00.000Z");
  expect(calls.lastCallAt("jsearch", "C")).toBeNull();
});

test("ApiCallLog prunes calls before a cutoff", () => {
  const calls = seededCalls();
  calls.pruneBefore("2026-10-01T00:00:00.000Z");
  expect(calls.countSince("jsearch", "2000-01-01T00:00:00.000Z")).toBe(2);
});
