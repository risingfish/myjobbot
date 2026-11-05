import { useState } from "react";
import type { ProfileContent, ResumeProfile } from "../../src/db/resumeStore.js";
import { saveResumeProfile } from "./resumeActions.js";
import type { SaveStatus } from "./useSave.js";

/** Saves an edit to the resume profile at once, tracking whether it is saving or failed and why one was refused, and handing on the saved profile. */
export function useProfileSave(onSaved: (profile: ResumeProfile) => void) {
    const [status, setStatus] = useState<SaveStatus>("idle");
    const [refused, setRefused] = useState<string | null>(null);
    const save = async (edit: ProfileContent) => {
        setStatus("saving");
        const result = await saveResumeProfile(edit).catch(() => null);
        setStatus(result === null ? "failed" : "idle");
        setRefused(result !== null && !result.ok ? result.error : null);
        if (result?.ok) onSaved(result.profile);
    };
    return { status, refused, save };
}
