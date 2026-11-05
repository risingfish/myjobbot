import { z } from "zod";

export const resumeFileType = z.enum(["md", "txt", "pdf", "docx"]);

export type ResumeFileType = z.infer<typeof resumeFileType>;

export const SKILL_GROUPS = ["engineering", "people", "project"] as const;

export const skillSchema = z.strictObject({ name: z.string().trim().min(1).max(80), group: z.enum(SKILL_GROUPS) });

export type Skill = z.infer<typeof skillSchema>;

export type SkillGroup = Skill["group"];

export interface ResumeUpload {
    text: string;
    fileName: string;
    fileType: ResumeFileType;
    uploadedAt: string;
}

export interface Resume extends ResumeUpload {
    contentId: string;
}

export interface ProfileContent {
    summary: string;
    skills: Skill[];
}

export interface ResumeProfile extends ProfileContent {
    resumeId: string;
    extractedAt: string;
    editedAt: string | null;
}

export interface ResumeStore {
    currentResume(userId: number): Promise<Resume | null>;
    saveResume(userId: number, upload: ResumeUpload): Promise<Resume>;
    profile(userId: number): Promise<ResumeProfile | null>;
    saveProfile(userId: number, profile: ResumeProfile): Promise<void>;
}
