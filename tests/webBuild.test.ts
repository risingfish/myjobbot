import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

const AGENT_SETTINGS = /^(LLM_|JSEARCH_API_KEY$|MYJOBBOT_|NODE_ENV$)/;
const ROUTES = ["/", "/recommended", "/jobs", "/reasoning", "/settings", "/settings/gmail/callback", "/_not-found"];

function buildEnv(): NodeJS.ProcessEnv {
    const kept = Object.entries(process.env).filter(([key]) => !AGENT_SETTINGS.test(key));
    return { ...Object.fromEntries(kept), NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", NEXT_DIST_DIR: ".next-test" };
}

function routePattern(path: string): RegExp {
    return new RegExp(`[○ƒ●] ${path.replace(/[/]/g, "\\/")}\\s`);
}

test("next build succeeds without agent settings and lists every route but no API", () => {
    const result = spawnSync("node_modules/.bin/next", ["build", "web"], { env: buildEnv(), encoding: "utf8" });
    expect(result.status, result.stderr + result.stdout).toBe(0);
    for (const path of ROUTES) expect(result.stdout).toMatch(routePattern(path));
    expect(result.stdout).not.toContain("/api");
}, 180_000);
