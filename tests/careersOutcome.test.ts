import { expect, test } from "vitest";
import { decideOutcome } from "../src/careers/outcome.js";
import { newSession } from "../src/careers/session.js";
import { JOB, POSTING_URL } from "./helpers/careersLookup.js";

test("a found finish with a blank job page is not found, whatever set the state", () => {
    const session = { ...newSession(JOB), lastOpened: "job" as const, jobPage: { url: POSTING_URL, text: " ", description: null }, finished: { found: true, reason: null } };
    expect(decideOutcome(session, { status: "finished", reason: "finish called", steps: 3 })).toEqual({ found: false, reason: "job_page_unreadable" });
});

test("a found lookup returns the job page's description with its format, or the page text as plain text", () => {
    const found = { finished: { found: true, reason: null }, lastOpened: "job" as const };
    const fromBoard = { ...newSession(JOB), ...found, jobPage: { url: POSTING_URL, text: "Backend Engineer\n\nBuild our APIs.", description: { text: "Build [our APIs](https://a.example).", format: "markdown" as const } } };
    const downloaded = { ...newSession(JOB), ...found, jobPage: { url: POSTING_URL, text: "Build APIs.", description: null } };
    const result = { status: "finished" as const, reason: "finish called", steps: 3 };
    expect(decideOutcome(fromBoard, result)).toMatchObject({ found: true, description: "Build [our APIs](https://a.example).", format: "markdown" });
    expect(decideOutcome(downloaded, result)).toMatchObject({ found: true, description: "Build APIs.", format: "text" });
});
