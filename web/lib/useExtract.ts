import { useState } from "react";
import type { ResumeProfile } from "../../src/db/resumeStore.js";
import { EXTRACT_FAILED } from "../../src/resumeProfile/profile.js";
import { extractResumeProfile } from "./resumeActions.js";

/** Extracts the resume profile through the server action, tracking whether it is running and why it failed, and handing on the new profile. */
export function useExtract(onExtracted: (profile: ResumeProfile) => void) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const extract = async () => {
        setBusy(true);
        const result = await extractResumeProfile().catch(() => ({ ok: false as const, error: EXTRACT_FAILED }));
        setBusy(false);
        setError(result.ok ? null : result.error);
        if (result.ok) onExtracted(result.profile);
    };
    return { busy, error, extract };
}
