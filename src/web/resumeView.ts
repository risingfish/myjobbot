import type { Resume } from "../db/resumeStore.js";

export type ResumeShown = { kind: "stored"; resume: Resume } | { kind: "file"; text: string } | { kind: "none" };

/** Says which resume the Settings page shows: the uploaded one, else the data folder's file, else none. */
export function resumeShown(stored: Resume | null, fileText: string | null): ResumeShown {
    if (stored !== null) return { kind: "stored", resume: stored };
    return fileText === null ? { kind: "none" } : { kind: "file", text: fileText };
}

/** Describes an uploaded resume by its file name and when it was uploaded, in the browser's time zone once known. */
export function uploadedLabel(resume: Pick<Resume, "fileName" | "uploadedAt">, timeZone: string | null): string {
    const when = timeZone === null ? resume.uploadedAt.slice(0, 10) : new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short", timeZone }).format(new Date(resume.uploadedAt));
    return `${resume.fileName} · uploaded ${when}`;
}
