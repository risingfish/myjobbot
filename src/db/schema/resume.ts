import type { Text } from "./columns.js";

export interface ResumesTable {
    user_id: number;
    text: string;
    file_name: string;
    file_type: string;
    uploaded_at: string;
    content_id: string;
}

export interface ResumeProfilesTable {
    user_id: number;
    resume_id: string;
    summary: string;
    skills: string;
    extracted_at: string;
    edited_at: Text;
}
