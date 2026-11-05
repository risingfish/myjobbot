import { z } from "zod";
import { skillSchema, type Resume, type ResumeProfile, type Skill, type SkillGroup } from "../db/resumeStore.js";

export const EXTRACT_FAILED = "The profile couldn't be extracted; nothing was changed";

const summary = z.string().trim().max(4000);

export const extractedProfile = z.strictObject({ summary, skills: z.array(skillSchema).min(1).max(100) });

export const editedProfile = z.strictObject({ summary, skills: z.array(skillSchema).max(100) });

/** Gives the key two skills share when they are the same skill, whatever their case or surrounding spaces. */
function skillKey(name: string): string {
    return name.trim().toLowerCase();
}

/** Keeps each skill once, in the group it was first listed in, whatever its case or surrounding spaces. */
export function dedupedSkills(skills: Skill[]): Skill[] {
    const seen = new Set<string>();
    return skills.filter((skill) => {
        const key = skillKey(skill.name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/** Names the first skill listed twice, ignoring case and surrounding spaces, or null when every skill is listed once. */
export function repeatedSkill(skills: Skill[]): string | null {
    const deduped = dedupedSkills(skills);
    return deduped.length === skills.length ? null : (skills.find((skill, at) => deduped[at] !== skill)?.name ?? null);
}

/** Says whether a profile came from an earlier resume than the one stored now. */
export function isStale(profile: Pick<ResumeProfile, "resumeId">, resume: Pick<Resume, "contentId">): boolean {
    return profile.resumeId !== resume.contentId;
}

/** Moves the named skill to another group, leaving every other skill where it was. */
export function movedSkill(skills: Skill[], name: string, group: SkillGroup): Skill[] {
    return skills.map((skill) => (skill.name === name ? { ...skill, group } : skill));
}
