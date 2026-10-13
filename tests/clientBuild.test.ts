import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { buildClient } from "../src/web/clientBuild.js";

test("the real Vite settings build the app into the folder they are given", async () => {
  const outDir = mkdtempSync(join(tmpdir(), "myjobbot-build-test-"));
  const before = readdirSync(".").sort();
  expect(await buildClient({ watch: false, outDir })).toBe(outDir);
  const html = readFileSync(join(outDir, "index.html"), "utf8");
  expect(html).toContain('<div id="root"></div>');
  expect(html).toContain("myjobbot's web UI needs JavaScript.");
  const script = /src="\/assets\/([\w.-]+\.js)"/.exec(html)?.[1];
  expect(script && existsSync(join(outDir, "assets", script))).toBe(true);
  expect(readdirSync(".").sort()).toEqual(before);
}, 30_000);

test("without a folder given, each build gets its own new private temporary folder", async () => {
  const first = await buildClient({ watch: false });
  const second = await buildClient({ watch: false });
  expect(first).not.toBe(second);
  for (const dir of [first, second]) {
    expect(dir.startsWith(join(tmpdir(), "myjobbot-client-"))).toBe(true);
    expect(existsSync(join(dir, "index.html"))).toBe(true);
    expect(statSync(dir).mode & 0o077).toBe(0);
  }
}, 60_000);
