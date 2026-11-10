import { sha16 } from "../../src/contentId.js";
import type { Resume, ResumeProfile, ResumeStore, ResumeUpload } from "../../src/db/resumeStore.js";
import { ownerOrRefuse, type MemoryUser } from "./memoryAuthTables.js";

export class MemoryResumeStore implements ResumeStore {
    private readonly rows = new Map<number, Resume>();
    private readonly profiles = new Map<number, string>();

    constructor(private readonly users: MemoryUser[] = []) {}

    dropUser(userId: number): void {
        this.rows.delete(userId);
        this.profiles.delete(userId);
    }

    async currentResume(userId: number): Promise<Resume | null> {
        return this.rows.get(userId) ?? null;
    }

    async saveResume(userId: number, upload: ResumeUpload): Promise<Resume> {
        ownerOrRefuse(this.users, userId, upload.uploadedAt);
        const resume = { ...upload, contentId: sha16(upload.text) };
        this.rows.set(userId, resume);
        return resume;
    }

    async profile(userId: number): Promise<ResumeProfile | null> {
        const row = this.profiles.get(userId);
        return row === undefined ? null : (JSON.parse(row) as ResumeProfile);
    }

    async saveProfile(userId: number, profile: ResumeProfile): Promise<void> {
        ownerOrRefuse(this.users, userId, profile.extractedAt);
        this.profiles.set(userId, JSON.stringify(profile));
    }
}
