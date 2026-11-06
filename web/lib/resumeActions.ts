"use server";

import { revalidatePath } from "next/cache.js";
import { describeError } from "../../src/errors.js";
import { RESUME_ERRORS } from "../../src/resume/limits.js";
import { extractWithModel } from "../../src/resumeProfile/open.js";
import { EXTRACT_FAILED } from "../../src/resumeProfile/profile.js";
import { editFor, extractFor, uploadFor, type ProfileResult, type UploadResult } from "./resumeRows.js";
import { getStores } from "./uiState.js";
import { guarded } from "./guard.js";

const NOT_SAVED: UploadResult = { ok: false, error: "The resume couldn't be saved" };

/** Reads and stores the resume file the Settings page's Resume section uploads, answering the stored resume or why it was refused. */
async function uploadResumeAction(form: FormData): Promise<UploadResult> {
    const file = form.get("resume");
    if (file === null || typeof file === "string") return { ok: false, error: RESUME_ERRORS.type };
    try {
        const result = await uploadFor((await getStores()).stores, file, new Date());
        if (result.ok) revalidatePath("/settings");
        return result;
    } catch (error) {
        console.error(`myjobbot: saving the resume failed: ${describeError(error)}`);
        return NOT_SAVED;
    }
}

/** Has the model extract a profile from the uploaded resume, waiting for it, and stores it in place of the one before. */
async function extractResumeProfileAction(): Promise<ProfileResult> {
    try {
        const { stores } = await getStores();
        const result = await extractFor(stores, (resume) => extractWithModel(process.env, stores, resume), new Date());
        if (result.ok) revalidatePath("/settings");
        return result;
    } catch (error) {
        console.error(`myjobbot: extracting the resume profile failed: ${describeError(error)}`);
        return { ok: false, error: EXTRACT_FAILED };
    }
}

/** Saves the owner's edit to the profile's summary and skills, answering the saved profile or why it was refused. */
async function saveResumeProfileAction(edit: unknown): Promise<ProfileResult> {
    const result = await editFor((await getStores()).stores, edit, new Date());
    if (result.ok) revalidatePath("/settings");
    return result;
}

export const uploadResume = guarded(uploadResumeAction, {});
export const extractResumeProfile = guarded(extractResumeProfileAction, {});
export const saveResumeProfile = guarded(saveResumeProfileAction, {});
