import { expect, test } from "vitest";
import { dedupedSkills, extractedProfile, isStale, movedSkill, repeatedSkill } from "../src/resumeProfile/profile.js";

const skill = (name: string, group: "engineering" | "people" | "project" = "engineering") => ({ name, group });

test("an extracted profile holds 1 to 100 skills in the three groups, short names and a summary of at most 4,000 characters", () => {
    const fine = { summary: "Remote senior backend roles", skills: [skill("TypeScript")] };
    expect(extractedProfile.safeParse(fine).success).toBe(true);
    const refused = [
        { ...fine, skills: [{ name: "Sales", group: "sales" }] },
        { ...fine, skills: [skill("x".repeat(81))] },
        { ...fine, skills: [] },
        { ...fine, skills: Array.from({ length: 101 }, (_, at) => skill(`skill ${at}`)) },
        { ...fine, summary: "x".repeat(4001) },
    ];
    expect(refused.map((profile) => extractedProfile.safeParse(profile).success)).toEqual([false, false, false, false, false]);
});

test("a skill listed twice is kept once, in its first group, whatever its case or spaces", () => {
    const skills = [skill("TypeScript"), skill("Hiring", "people"), skill(" typescript ", "project"), skill("HIRING", "project")];
    expect(dedupedSkills(skills)).toEqual([skill("TypeScript"), skill("Hiring", "people")]);
    expect([repeatedSkill(skills), repeatedSkill(dedupedSkills(skills))]).toEqual([" typescript ", null]);
});

test("a profile is stale once the stored resume is another one", () => {
    expect([isStale({ resumeId: "a" }, { contentId: "a" }), isStale({ resumeId: "a" }, { contentId: "b" })]).toEqual([false, true]);
});

test("moving a skill changes only its group", () => {
    const skills = [skill("TypeScript"), skill("Hiring", "people")];
    expect(movedSkill(skills, "Hiring", "project")).toEqual([skill("TypeScript"), skill("Hiring", "project")]);
});
