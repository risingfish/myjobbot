import type { Kysely, Selectable } from "kysely";
import { sha16 } from "../../contentId.js";
import { z } from "zod";
import { resumeFileType, skillSchema, type Resume, type ResumeProfile, type ResumeStore, type ResumeUpload } from "../resumeStore.js";
import type { Database } from "../schema.js";
import type { ResumeProfilesTable, ResumesTable } from "../schema/resume.js";
import { ensureOwner } from "./searchSettingsStore.js";

export class KyselyResumeStore implements ResumeStore {
    constructor(private readonly db: Kysely<Database>) {}

    /** Returns a user's uploaded resume, or null when none has been uploaded. */
    async currentResume(userId: number): Promise<Resume | null> {
        const row = await this.db.selectFrom("resumes").selectAll().where("user_id", "=", userId).executeTakeFirst();
        return row === undefined ? null : fromRow(row);
    }

    /** Stores a user's uploaded resume in place of the one before, creating the owner first, and returns it with its content id. */
    async saveResume(userId: number, upload: ResumeUpload): Promise<Resume> {
        const resume = { ...upload, contentId: sha16(upload.text) };
        const row = { text: resume.text, file_name: resume.fileName, file_type: resume.fileType, uploaded_at: resume.uploadedAt, content_id: resume.contentId };
        await this.db.transaction().execute(async (trx) => {
            await ensureOwner(trx, upload.uploadedAt);
            await trx
                .insertInto("resumes")
                .values({ user_id: userId, ...row })
                .onDuplicateKeyUpdate(row)
                .execute();
        });
        return resume;
    }

    /** Returns the profile extracted from a user's resume, as last extracted or edited, or null when none has been. */
    async profile(userId: number): Promise<ResumeProfile | null> {
        const row = await this.db.selectFrom("resume_profiles").selectAll().where("user_id", "=", userId).executeTakeFirst();
        return row === undefined ? null : profileFromRow(row);
    }

    /** Stores a user's profile in place of the one before, creating the owner first. */
    async saveProfile(userId: number, profile: ResumeProfile): Promise<void> {
        const row = { resume_id: profile.resumeId, summary: profile.summary, skills: JSON.stringify(profile.skills), extracted_at: profile.extractedAt, edited_at: profile.editedAt };
        await this.db.transaction().execute(async (trx) => {
            await ensureOwner(trx, profile.extractedAt);
            await trx
                .insertInto("resume_profiles")
                .values({ user_id: userId, ...row })
                .onDuplicateKeyUpdate(row)
                .execute();
        });
    }
}

const storedSkills = z.array(skillSchema);

/** Turns a stored profile row into a profile, its skills checked as they are read. */
function profileFromRow(row: Selectable<ResumeProfilesTable>): ResumeProfile {
    return { summary: row.summary, skills: storedSkills.parse(JSON.parse(row.skills)), resumeId: row.resume_id, extractedAt: row.extracted_at, editedAt: row.edited_at };
}

/** Turns a stored resume row into a resume. */
function fromRow(row: Selectable<ResumesTable>): Resume {
    return { text: row.text, fileName: row.file_name, fileType: resumeFileType.parse(row.file_type), uploadedAt: row.uploaded_at, contentId: row.content_id };
}
