import { expect, test } from "vitest";
import { readResume } from "../src/resume/read.js";
import { RESUME_DOCX, RESUME_PDF, SCANNED_PDF } from "./helpers/resumeFixtures.js";

const bytes = (base64: string) => new Uint8Array(Buffer.from(base64, "base64"));

function wordsInOrder(text: string): boolean {
    const at = ["Jordan Example", "Staff Software Engineer", "Line 1: built TypeScript", "Line 44:", "Closing line: roadmaps and hiring."].map((words) => text.indexOf(words));
    return at.every((index, i) => index >= 0 && (i === 0 || index > (at[i - 1] ?? 0)));
}

test("a PDF resume's text comes out with its words in order", async () => {
    const read = await readResume(bytes(RESUME_PDF), "pdf");
    expect(read.ok && wordsInOrder(read.text)).toBe(true);
});

test("a Word resume's text comes out with its words in order", async () => {
    const read = await readResume(bytes(RESUME_DOCX), "docx");
    expect(read.ok && wordsInOrder(read.text)).toBe(true);
});

test("a PDF that is only an image has no text to read", async () => {
    expect(await readResume(bytes(SCANNED_PDF), "pdf")).toEqual({ ok: false, error: "No text could be read from that file" });
});

test("a cut-off PDF or Word file can't be read, and no library message is passed on", async () => {
    const half = (data: Uint8Array) => data.subarray(0, Math.floor(data.length / 2));
    expect(await readResume(half(bytes(RESUME_PDF)), "pdf")).toEqual({ ok: false, error: "That file couldn't be read" });
    expect(await readResume(half(bytes(RESUME_DOCX)), "docx")).toEqual({ ok: false, error: "That file couldn't be read" });
});
