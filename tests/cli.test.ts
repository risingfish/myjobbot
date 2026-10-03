import { expect, test } from "vitest";
import { runCli } from "./helpers/cli.js";

test("cli prints usage and exits 2 without a command", () => {
  const result = runCli([]);
  expect(result.status).toBe(2);
  expect(result.stderr).toContain("usage: myjobbot run");
});
