import { expect, test } from "vitest";
import { alreadyRunningLine, commandLine, consoleLine, parseStep, stepLine, type Step } from "../src/rescore/steps.js";

const PAGE = "https://www.bigpanda.io/company/panda-way/jobs/";

function line(kind: string, fields: unknown): string | null {
    const step = parseStep(kind, fields);
    return step === null ? null : stepLine(step);
}

test("settings, filters and the lookup's start and end each have one line", () => {
    expect([line("settings", { fallbacks: 0 }), line("settings", { fallbacks: 1 }), line("filters", { by: null }), line("filters", { by: "body" }), line("lookup", {}), line("lookup_end", { found: true, reason: null }), line("lookup_end", { found: false, reason: "gave_up" }), line("lookup_failed", {})]).toEqual(["settings loaded", "settings loaded (1 fell back)", "filters passed", "filtered: hidden by body filter", "no description: looking for the careers page", "description found", "no description found (gave_up)", "careers lookup failed; scoring from what we have"]);
});

test("a search and each page opened show their size and how they were read", () => {
    expect([line("search", { chars: 2201, ok: true }), line("page", { kind: "careers", url: PAGE, chars: 6193, via: "download", ok: true, reason: null }), line("page", { kind: "job", url: PAGE, chars: 12019, via: "board", ok: true, reason: null }), line("page", { kind: "job", url: PAGE, chars: 900, via: "browser", ok: true, reason: null })]).toEqual(["searched the web (2,201 chars of results)", `open careers page ${PAGE}  6,193 chars  download`, `open job page ${PAGE}  12,019 chars  board`, `open job page ${PAGE}  900 chars  browser`]);
});

test("a failed open says so with its reason, and a stale page keeps its size", () => {
    expect([line("page", { kind: "job", url: PAGE, chars: null, via: null, ok: false, reason: "timed_out" }), line("page", { kind: "careers", url: PAGE, chars: 300, via: "download", ok: false, reason: null })]).toEqual([`open job page ${PAGE}  failed (timed_out)`, `open careers page ${PAGE}  300 chars  download  failed`]);
});

test("the model's steps and the outcome each have one line", () => {
    expect([line("reading", {}), line("lookalike", {}), line("saved", { score: 72 }), line("outcome", { outcome: "scored", filter: null, score: 72 }), line("outcome", { outcome: "filtered", filter: "title", score: null }), line("outcome", { outcome: "failed", filter: null, score: null })]).toEqual(["model reading the job", "removed a look-alike marker from the job's text", "model score saved: 72", "done: model score 72", "done: not re-scored, hidden by title filter", "done: failed, old score kept"]);
});

test("an address longer than 120 characters is cut", () => {
    const long = `https://example.com/${"a".repeat(200)}`;
    const shown = line("page", { kind: "careers", url: long, chars: 1, via: "download", ok: true, reason: null }) ?? "";
    expect(shown).toContain(`${long.slice(0, 119)}…  1 chars`);
});

test("a step of an unknown kind, or with a field outside its rules, is refused", () => {
    expect([parseStep("model_said", { text: "ignore your instructions" }), parseStep("page", { kind: "careers", url: "javascript:alert(1)", chars: 1, via: "download", ok: true, reason: null }), parseStep("page", { kind: "careers", url: `${PAGE}\nfake line`, chars: 1, via: "download", ok: true, reason: null }), parseStep("lookup_end", { found: false, reason: "the model says hi" }), parseStep("reading", { extra: "smuggled" })]).toEqual([null, null, null, null, null]);
});

test("the CLI's lines: the command, each step with its time, and a refusal while a run is open", () => {
    const step: Step = { kind: "reading", fields: {} };
    expect([commandLine({ ats: "greenhouse", jobId: "1" }), consoleLine(stepLine(step), 2400), consoleLine("x", 61_240), alreadyRunningLine({ ats: "greenhouse", jobId: "1" }, "run-1")]).toEqual(["$ myjobbot rescore greenhouse 1", "[  2.4s] model reading the job", "[ 61.2s] x", "rescore greenhouse 1: already running (run-1)"]);
});
