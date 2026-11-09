import { expect, test } from "vitest";
import type { TestStores } from "./memoryStore.js";
import { sha16 } from "../../src/contentId.js";
import type { MakeStores } from "./storeContract.js";

const FIRST = { text: "# Ada Lovelace\n\nTypeScript, Kubernetes", fileName: "resume.md", fileType: "md" as const, uploadedAt: "2026-11-05T10:00:00.000Z" };
const SECOND = { text: "Ada Lovelace — staff engineer", fileName: "resume.txt", fileType: "txt" as const, uploadedAt: "2026-11-05T11:00:00.000Z" };

async function replacedOnUpload({ resume }: TestStores): Promise<void> {
    expect(await resume.currentResume()).toBeNull();
    expect(await resume.saveResume(FIRST)).toEqual({ ...FIRST, contentId: sha16(FIRST.text) });
    expect(await resume.currentResume()).toEqual({ ...FIRST, contentId: sha16(FIRST.text) });
    await resume.saveResume(SECOND);
    expect(await resume.currentResume()).toEqual({ ...SECOND, contentId: sha16(SECOND.text) });
}

async function longTextRoundTrips({ resume }: TestStores): Promise<void> {
    const text = "Zürich 🚀 ".repeat(10_000).slice(0, 100_000);
    expect(text.length).toBe(100_000);
    await resume.saveResume({ ...FIRST, text });
    expect((await resume.currentResume())?.text).toBe(text);
}

const PROFILE = {
    summary: "Senior backend roles, remote 🌍",
    skills: [
        { name: "TypeScript", group: "engineering" as const },
        { name: "Mentoring", group: "people" as const },
        { name: "Roadmaps", group: "project" as const },
    ],
    resumeId: sha16(FIRST.text),
    extractedAt: "2026-11-05T10:05:00.000Z",
    editedAt: null,
};

async function profileKeptAcrossUploads({ resume }: TestStores): Promise<void> {
    expect(await resume.profile()).toBeNull();
    await resume.saveProfile(PROFILE);
    expect(await resume.profile()).toEqual(PROFILE);
    const edited = { ...PROFILE, skills: [...PROFILE.skills].reverse(), editedAt: "2026-11-05T10:10:00.000Z" };
    await resume.saveProfile(edited);
    await resume.saveResume(SECOND);
    expect(await resume.profile()).toEqual(edited);
}

function withStores(makeStores: MakeStores, check: (stores: TestStores) => Promise<void>): () => Promise<void> {
    return async () => {
        const stores = await makeStores();
        try {
            await check(stores);
        } finally {
            await stores.close();
        }
    };
}

async function unknownUserRefused(stores: TestStores): Promise<void> {
    await expect(stores.forUser(99).resume.saveResume(FIRST)).rejects.toThrow();
    expect(await stores.forUser(99).resume.currentResume()).toBeNull();
}

export function resumeContract(makeStores: MakeStores): void {
    test("the resume is empty until one is saved, and a new upload replaces it with its own content id", withStores(makeStores, replacedOnUpload));
    test("a profile reads back as saved, an edit included, and survives a new resume upload unchanged", withStores(makeStores, profileKeptAcrossUploads));
    test("a resume of 100,000 characters, emoji included, reads back exactly", withStores(makeStores, longTextRoundTrips));
    test("a resume saved for a user that doesn't exist is refused", withStores(makeStores, unknownUserRefused));
}
