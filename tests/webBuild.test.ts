import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

const AGENT_SETTINGS = /^(LLM_|JSEARCH_API_KEY$|MYJOBBOT_|NODE_ENV$)/;
const ROUTES = ["/", "/recommended", "/applied", "/jobs", "/reasoning", "/settings", "/sign-in", "/_not-found", "/api/rescores/[id]"];
const MAY_PRERENDER = new Set(["/_not-found", "/api/rescores/[id]"]);

function buildEnv(): NodeJS.ProcessEnv {
    const kept = Object.entries(process.env).filter(([key]) => !AGENT_SETTINGS.test(key));
    return { ...Object.fromEntries(kept), NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", NEXT_DIST_DIR: ".next-test" };
}

function routePattern(path: string): RegExp {
    const marks = MAY_PRERENDER.has(path) ? "[○ƒ●]" : "ƒ";
    return new RegExp(`${marks} ${path.replace(/[/[\]]/g, "\\$&")}\\s`);
}

test("next build succeeds without agent settings, lists every route, renders every page per request, and has no API but the re-score log", () => {
    const result = spawnSync("node_modules/.bin/next", ["build", "web"], { env: buildEnv(), encoding: "utf8" });
    expect(result.status, result.stderr + result.stdout).toBe(0);
    for (const path of ROUTES) expect(result.stdout).toMatch(routePattern(path));
    expect(result.stdout.match(/\/api\/\S*/g)).toEqual(["/api/rescores/[id]"]);
}, 180_000);
