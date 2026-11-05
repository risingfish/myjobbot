import mammoth from "mammoth";
import { extractText } from "unpdf";
import type { ResumeFileType } from "../db/resumeStore.js";
import { checkedText, RESUME_ERRORS, type ResumeText } from "./limits.js";

/** Reads an uploaded resume's text from its bytes, by its type, in memory only, checked against the resume limits. */
export async function readResume(bytes: Uint8Array, type: ResumeFileType): Promise<ResumeText> {
    try {
        return checkedText(await plainText(bytes, type));
    } catch {
        return { ok: false, error: RESUME_ERRORS.unreadable };
    }
}

/** Gives a file's text alone: Markdown and plain text as UTF-8, PDF through unpdf and Word through mammoth, never any markup. */
async function plainText(bytes: Uint8Array, type: ResumeFileType): Promise<string> {
    if (type === "pdf") return (await extractText(bytes.slice(), { mergePages: true })).text;
    if (type === "docx") return (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    return new TextDecoder("utf-8").decode(bytes);
}
