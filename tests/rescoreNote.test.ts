import { expect, test } from "vitest";
import { rescoreNote } from "../src/web/rescoreNote.js";
import { jobRowView } from "./helpers/rowFixtures.js";

test("a re-score's note is one of a fixed set: none when scored, the filter when filtered, and the failure otherwise", () => {
    const row = jobRowView();
    expect([rescoreNote({ outcome: "scored", row }), rescoreNote({ outcome: "filtered", note: "hidden by body filter", row }), rescoreNote({ outcome: "filtered", note: "hidden by title filter", row }), rescoreNote({ outcome: "failed" })]).toEqual([null, "Not re-scored: hidden by body filter", "Not re-scored: hidden by title filter", "Re-score failed; the old score is kept"]);
    expect(rescoreNote({ outcome: "filtered", note: "<b>anything else</b>", row })).toBe("Not re-scored: hidden by a filter");
});
