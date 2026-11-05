import { expect, test } from "vitest";
import { sha16 } from "../src/contentId.js";
import { OWNER_ID } from "../src/db/searchSettingsStore.js";
import { editFor, extractFor, uploadFor } from "../web/lib/resumeRows.js";
import { memoryStores } from "./helpers/memoryStore.js";

const NOW = new Date("2026-11-05T10:00:00.000Z");

function file(name: string, text: string) {
    const bytes = new TextEncoder().encode(text);
    return { name, size: bytes.length, arrayBuffer: async () => bytes.buffer };
}

test("a Markdown or text resume is read as UTF-8 and stored as the owner's resume", async () => {
    const stores = memoryStores();
    const markdown = await uploadFor(stores, file("resume.md", "# Zoë Müller\n\nTypeScript 🚀\n"), NOW);
    expect(markdown).toEqual({ ok: true, resume: { text: "# Zoë Müller\n\nTypeScript 🚀", fileName: "resume.md", fileType: "md", uploadedAt: NOW.toISOString(), contentId: sha16("# Zoë Müller\n\nTypeScript 🚀") } });
    await uploadFor(stores, file("cv.txt", "Plain <b>text</b>"), NOW);
    expect((await stores.resume.currentResume(OWNER_ID))?.text).toBe("Plain <b>text</b>");
});

test("a refused file answers its fixed message and leaves the stored resume alone", async () => {
    const stores = memoryStores();
    await uploadFor(stores, file("resume.md", "# Ada"), NOW);
    expect(await uploadFor(stores, file("photo.png", "x"), NOW)).toEqual({ ok: false, error: "That file type isn't supported (use .md, .txt, .pdf or .docx)" });
    expect(await uploadFor(stores, file("empty.txt", "  \n"), NOW)).toEqual({ ok: false, error: "No text could be read from that file" });
    expect(await uploadFor(stores, { ...file("big.md", "a"), size: 5 * 1024 * 1024 + 1 }, NOW)).toEqual({ ok: false, error: "That file is over 5 MB" });
    expect((await stores.resume.currentResume(OWNER_ID))?.text).toBe("# Ada");
});

const SKILLS = [
    { name: "TypeScript", group: "engineering" as const },
    { name: "Mentoring", group: "people" as const },
];

test("extracting with no uploaded resume is refused before the model is asked", async () => {
    const stores = memoryStores();
    let asked = false;
    const extract = async () => {
        asked = true;
        return { ok: true as const, profile: { summary: "s", skills: SKILLS } };
    };
    expect([await extractFor(stores, extract, NOW), asked, await stores.resume.profile(OWNER_ID)]).toEqual([{ ok: false, error: "Upload a resume first" }, false, null]);
});

test("an edit is checked and saved marked edited, removing every skill allowed, and an extraction ties the profile to its resume", async () => {
    const stores = memoryStores();
    await uploadFor(stores, file("resume.md", "# Ada"), NOW);
    const extracted = await extractFor(stores, async () => ({ ok: true, profile: { summary: "Senior roles", skills: SKILLS } }), NOW);
    expect(extracted).toEqual({ ok: true, profile: { summary: "Senior roles", skills: SKILLS, resumeId: sha16("# Ada"), extractedAt: NOW.toISOString(), editedAt: null } });
    const later = new Date("2026-11-05T11:00:00.000Z");
    const moved = [SKILLS[0], { name: "Mentoring", group: "project" as const }];
    expect(await editFor(stores, { summary: "Remote senior roles", skills: moved }, later)).toMatchObject({ ok: true, profile: { summary: "Remote senior roles", skills: moved, editedAt: later.toISOString() } });
    expect(await editFor(stores, { summary: "", skills: [] }, later)).toMatchObject({ ok: true, profile: { skills: [] } });
    expect((await editFor(stores, { summary: "s", skills: [{ name: "x".repeat(81), group: "people" }] }, later)).ok).toBe(false);
    expect((await stores.resume.profile(OWNER_ID))?.skills).toEqual([]);
});

test("adding a skill already listed, whatever its case, is refused", async () => {
    const stores = memoryStores();
    await uploadFor(stores, file("resume.md", "# Ada"), NOW);
    await extractFor(stores, async () => ({ ok: true, profile: { summary: "s", skills: SKILLS } }), NOW);
    expect(await editFor(stores, { summary: "s", skills: [...SKILLS, { name: "typescript", group: "project" }] }, NOW)).toEqual({ ok: false, error: "That skill is already listed" });
});
