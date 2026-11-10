import { expect, test } from "vitest";
import { rescoreNote } from "../src/web/rescoreNote.js";

test("a re-score's note is one of a fixed set: none when scored, the filter when filtered, and the failure when it failed or couldn't start", () => {
    expect([rescoreNote({ outcome: "scored", filter: null, score: 72 }), rescoreNote({ outcome: "filtered", filter: "body", score: null }), rescoreNote({ outcome: "filtered", filter: "title", score: null }), rescoreNote({ outcome: "failed", filter: null, score: null }), rescoreNote({ failed: true })]).toEqual([null, "Not re-scored: hidden by body filter", "Not re-scored: hidden by title filter", "Re-score failed; the old score is kept", "Re-score failed; the old score is kept"]);
    expect(rescoreNote({ outcome: "filtered", filter: null, score: null })).toBe("Not re-scored: hidden by a filter");
});

test("a re-score refused before it started shows the refusal as given", () => {
    expect(rescoreNote({ refused: "Your account is deactivated. Reactivate it on the Account tab first." })).toBe("Your account is deactivated. Reactivate it on the Account tab first.");
});
