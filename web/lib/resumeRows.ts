import type { Resume, ResumeProfile } from "../../src/db/resumeStore.js";
import type { UserStores } from "../../src/db/userStores.js";
import { fileTypeOf, RESUME_ERRORS, sizeProblem } from "../../src/resume/limits.js";
import { readResume } from "../../src/resume/read.js";
import type { Extracted } from "../../src/resumeProfile/extract.js";
import { editedProfile, repeatedSkill } from "../../src/resumeProfile/profile.js";

export type UploadResult = { ok: true; resume: Resume } | { ok: false; error: string };

export interface UploadedFile {
    name: string;
    size: number;
    arrayBuffer(): Promise<ArrayBuffer>;
}

/** Reads an uploaded resume file and stores its text as the owner's resume, or says with a fixed message why it was refused. */
export async function uploadFor(stores: Pick<UserStores, "resume">, file: UploadedFile, now: Date): Promise<UploadResult> {
    const fileType = fileTypeOf(file.name);
    if (fileType === null) return { ok: false, error: RESUME_ERRORS.type };
    const tooLarge = sizeProblem(file.size);
    if (tooLarge !== null) return { ok: false, error: tooLarge };
    const read = await readResume(new Uint8Array(await file.arrayBuffer()), fileType);
    if (!read.ok) return read;
    const upload = { text: read.text, fileName: file.name, fileType, uploadedAt: now.toISOString() };
    return { ok: true, resume: await stores.resume.saveResume(upload) };
}

export type ProfileResult = { ok: true; profile: ResumeProfile } | { ok: false; error: string };

const PROFILE_ERRORS = { noResume: "Upload a resume first", noProfile: "Extract a profile first", repeated: "That skill is already listed", refused: "That profile can't be saved: a summary of at most 4,000 characters and up to 100 skills of at most 80 characters" } as const;

/** Extracts a profile from the owner's uploaded resume and stores it in place of the one before, or says why nothing was stored. */
export async function extractFor(stores: Pick<UserStores, "resume">, extract: (resume: Resume) => Promise<Extracted>, now: Date): Promise<ProfileResult> {
    const resume = await stores.resume.currentResume();
    if (resume === null) return { ok: false, error: PROFILE_ERRORS.noResume };
    const extracted = await extract(resume);
    if (!extracted.ok) return extracted;
    const profile = { ...extracted.profile, resumeId: resume.contentId, extractedAt: now.toISOString(), editedAt: null };
    await stores.resume.saveProfile(profile);
    return { ok: true, profile };
}

/** Saves the owner's edit to the profile's summary and skills, marked edited, once it is checked; a skill listed twice is refused. */
export async function editFor(stores: Pick<UserStores, "resume">, edit: unknown, now: Date): Promise<ProfileResult> {
    const parsed = editedProfile.safeParse(edit);
    if (!parsed.success) return { ok: false, error: PROFILE_ERRORS.refused };
    if (repeatedSkill(parsed.data.skills) !== null) return { ok: false, error: PROFILE_ERRORS.repeated };
    const current = await stores.resume.profile();
    if (current === null) return { ok: false, error: PROFILE_ERRORS.noProfile };
    const profile = { ...current, ...parsed.data, editedAt: now.toISOString() };
    await stores.resume.saveProfile(profile);
    return { ok: true, profile };
}
