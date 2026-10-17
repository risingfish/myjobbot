import { expect, test } from "vitest";
import { decideOutcome } from "../src/careers/outcome.js";
import { newSession } from "../src/careers/session.js";
import { JOB, POSTING_URL } from "./helpers/careersLookup.js";

test("a found finish with a blank job page is not found, whatever set the state", () => {
    const session = { ...newSession(JOB), lastOpened: "job" as const, jobPage: { url: POSTING_URL, text: " " }, finished: { found: true, reason: null } };
    expect(decideOutcome(session, { status: "finished", reason: "finish called", steps: 3 })).toEqual({ found: false, reason: "job_page_unreadable" });
});
