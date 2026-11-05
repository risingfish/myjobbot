import { expect, test } from "vitest";
import { checkedText, fileTypeOf, RESUME_ERRORS, sizeProblem } from "../src/resume/limits.js";

test("a resume's type comes from its file name's extension alone, and anything else is refused", () => {
    expect(["resume.md", "CV.TXT", "a.b.pdf", "Resume.Docx"].map(fileTypeOf)).toEqual(["md", "txt", "pdf", "docx"]);
    expect(["photo.png", "old.doc", "resume", "md", ".md.png"].map(fileTypeOf)).toEqual([null, null, null, null, null]);
});

test("a file of 5 MB is accepted and one byte more is refused", () => {
    expect([sizeProblem(5 * 1024 * 1024), sizeProblem(5 * 1024 * 1024 + 1)]).toEqual([null, RESUME_ERRORS.size]);
    expect(RESUME_ERRORS.size).toBe("That file is over 5 MB");
});

test("a resume's text is trimmed, and refused when empty or over 100,000 characters", () => {
    expect(checkedText("  \n# Ada\n  ")).toEqual({ ok: true, text: "# Ada" });
    expect(checkedText(" \n\t ")).toEqual({ ok: false, error: "No text could be read from that file" });
    expect(checkedText("🚀".repeat(50_000))).toEqual({ ok: true, text: "🚀".repeat(50_000) });
    expect(checkedText(`${"🚀".repeat(50_000)}a`)).toEqual({ ok: false, error: "The resume is over 100,000 characters" });
});
