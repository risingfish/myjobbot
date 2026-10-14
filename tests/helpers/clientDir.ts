import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const TEST_ASSET = "app-abc123.js";

export function makeClientDir(withIndex = true): string {
  const dir = mkdtempSync(join(tmpdir(), "myjobbot-client-test-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets", TEST_ASSET), "console.log('app');");
  if (withIndex) {
    const html = `<!doctype html><noscript>myjobbot's web UI needs JavaScript.</noscript><div id="root"></div><script type="module" src="/assets/${TEST_ASSET}"></script>`;
    writeFileSync(join(dir, "index.html"), html);
  }
  return dir;
}
