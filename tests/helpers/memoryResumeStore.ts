import { sha16 } from "../../src/contentId.js";
import type { Resume, ResumeProfile, ResumeStore, ResumeUpload } from "../../src/db/resumeStore.js";

export class MemoryResumeStore implements ResumeStore {
    private readonly rows = new Map<number, Resume>();
    private readonly profiles = new Map<number, string>();

    async currentResume(userId: number): Promise<Resume | null> {
        return this.rows.get(userId) ?? null;
    }

    async saveResume(userId: number, upload: ResumeUpload): Promise<Resume> {
        const resume = { ...upload, contentId: sha16(upload.text) };
        this.rows.set(userId, resume);
        return resume;
    }

    async profile(userId: number): Promise<ResumeProfile | null> {
        const row = this.profiles.get(userId);
        return row === undefined ? null : (JSON.parse(row) as ResumeProfile);
    }

    async saveProfile(userId: number, profile: ResumeProfile): Promise<void> {
        this.profiles.set(userId, JSON.stringify(profile));
    }
}
