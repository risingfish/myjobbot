import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { fileTrace } from "../src/agent/trace.js";
import { readJsonl } from "./helpers/trace.js";

test("fileTrace stamps every line with the run id and time", () => {
  const path = join(mkdtempSync(join(tmpdir(), "myjobbot-trace-")), "run.jsonl");
  const trace = fileTrace(path, "run-123");
  trace.write({ type: "start" });
  trace.write({ type: "end" });
  const lines = readJsonl(path);
  expect(lines).toMatchObject([{ run_id: "run-123", type: "start" }, { run_id: "run-123", type: "end" }]);
  expect(lines.every((line) => typeof line.at === "string")).toBe(true);
});
