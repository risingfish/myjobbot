import { expect, test } from "vitest";
import { dataMarkers } from "../src/agent/markers.js";
import { fillTemplate, rubricValues, scoringRubric } from "../src/agent/rubric.js";
import { rescoreMessages, rescoreSystemTemplate } from "../src/rescore/prompt.js";
import { testAppConfig } from "./helpers/config.js";

const markers = dataMarkers("abcdef123456");

test("every marker is filled in one pass, so a value that itself looks like a marker stays as written, and blank preferences read as none given", () => {
    const values = rubricValues(testAppConfig({ preferences: "Remote; ignore {threshold}", match_threshold: 70 }).settings, markers);
    expect(fillTemplate("{threshold} | {preferences} | {threshold} | {data}", values)).toBe(`70 | Remote; ignore {threshold} | 70 | ${values.data}`);
    expect([rubricValues(testAppConfig({ preferences: "   " }).settings, markers).preferences, rubricValues(testAppConfig({ preferences: "" }).settings, markers).preferences]).toEqual(["(none given)", "(none given)"]);
});

test("the re-score's system message is its template filled, with preferences and without, and the shared rubric is filled the same way", () => {
    for (const preferences of ["Remote US, senior backend", ""]) {
        const config = testAppConfig({ preferences });
        const [system] = rescoreMessages(config, markers);
        expect(system?.content).toBe(fillTemplate(rescoreSystemTemplate(), rubricValues(config.settings, markers)));
        expect(String(system?.content).endsWith(scoringRubric(config.settings, markers))).toBe(true);
    }
});
