import { resumeFileType, type ResumeFileType } from "../db/resumeStore.js";

const MAX_BYTES = 5 * 1024 * 1024;

const MAX_CHARS = 100_000;

export const RESUME_ERRORS = {
    type: "That file type isn't supported (use .md, .txt, .pdf or .docx)",
    size: "That file is over 5 MB",
    empty: "No text could be read from that file",
    long: "The resume is over 100,000 characters",
    unreadable: "That file couldn't be read",
} as const;

export type ResumeText = { ok: true; text: string } | { ok: false; error: string };

const EXTENSION = /\.([^.]+)$/;

/** Names a resume file's type from its name's extension, the only thing trusted about it, or null for any other file. */
export function fileTypeOf(name: string): ResumeFileType | null {
    const parsed = resumeFileType.safeParse(EXTENSION.exec(name)?.[1]?.toLowerCase());
    return parsed.success ? parsed.data : null;
}

/** Says why a file of this many bytes is too large to upload, or null when it fits. */
export function sizeProblem(bytes: number): string | null {
    return bytes > MAX_BYTES ? RESUME_ERRORS.size : null;
}

/** Trims a resume's text and checks it holds something and fits the length limit. */
export function checkedText(text: string): ResumeText {
    const trimmed = text.trim();
    if (trimmed === "") return { ok: false, error: RESUME_ERRORS.empty };
    if (trimmed.length > MAX_CHARS) return { ok: false, error: RESUME_ERRORS.long };
    return { ok: true, text: trimmed };
}
