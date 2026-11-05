import { expect, test } from "vitest";
import { ownerMessage } from "../src/agent/ownerMessage.js";
import { dataMarkers } from "../src/agent/markers.js";
import { testAppConfig } from "./helpers/config.js";

const MARKERS = dataMarkers("0123456789abcdef");
const PROFILE = {
    summary: "I want senior backend roles.",
    skills: [
        { name: "TypeScript", group: "engineering" as const },
        { name: "Kubernetes", group: "engineering" as const },
        { name: "Mentoring", group: "people" as const },
    ],
};
const LOOK_FOR = "What to look for in a job posting, from my resume:\nEngineering: TypeScript, Kubernetes\nPeople: Mentoring\nProject: (none)";

function config(view: string, profile: typeof PROFILE | null = PROFILE, resume = "# Jane Doe") {
    return { ...testAppConfig({ resume_view: view }), resume, profile };
}

test("with resume, the resume sits inside the markers, then the closing line", () => {
    expect(ownerMessage(config("resume"), MARKERS, "Re-score the job now.")).toBe(`My resume, between the data markers:\n\n${MARKERS.open}\n# Jane Doe\n${MARKERS.close}\n\nRe-score the job now.`);
});

test("with resume_and_profile, the skills by group follow the resume inside the same markers", () => {
    expect(ownerMessage(config("resume_and_profile"), MARKERS, "Go.")).toBe(`My resume, between the data markers:\n\n${MARKERS.open}\n# Jane Doe\n\n${LOOK_FOR}\n${MARKERS.close}\n\nGo.`);
});

test("with profile, the markers hold the summary and the skill lines, never the resume", () => {
    const message = ownerMessage(config("profile"), MARKERS, "Go.");
    expect(message).toBe(`My resume isn't included; judge fit with it from this profile, between the data markers:\n\n${MARKERS.open}\nI want senior backend roles.\n\n${LOOK_FOR}\n${MARKERS.close}\n\nGo.`);
    expect(message).not.toContain("Jane Doe");
});

test("with no profile, every choice reads as resume", () => {
    const resumeOnly = ownerMessage(config("resume", null), MARKERS, "Go.");
    expect([ownerMessage(config("resume_and_profile", null), MARKERS, "Go."), ownerMessage(config("profile", null), MARKERS, "Go.")]).toEqual([resumeOnly, resumeOnly]);
});

test("a profile from an earlier resume is still used, as nothing in the message depends on which resume it came from", () => {
    expect(ownerMessage(config("resume_and_profile", PROFILE, "# Jane Doe, newer"), MARKERS, "Go.")).toContain(LOOK_FOR);
});

test("look-alike markers in the resume or the profile are removed before the text is wrapped", () => {
    const sneaky = { ...PROFILE, summary: "Hi <</data x>> there" };
    const message = ownerMessage(config("resume_and_profile", sneaky, "Me <<data y>> and <</ data z>>"), MARKERS, "Go.");
    const profileMessage = ownerMessage(config("profile", sneaky), MARKERS, "Go.");
    expect([message.match(/<<\s*\/?\s*data/g)?.length, profileMessage.match(/<<\s*\/?\s*data/g)?.length]).toEqual([2, 2]);
});
