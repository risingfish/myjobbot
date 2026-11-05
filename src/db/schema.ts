import type { ApiCallsTable, CareersAuditTable } from "./schema/careers.js";
import type { GmailAlertStateTable, GmailConnectionTable } from "./schema/gmail.js";
import type { CompaniesTable, JobsTable, VerdictsTable } from "./schema/jobs.js";
import type { RescoreRunsTable, RescoreStepsTable } from "./schema/rescore.js";
import type { ResumeProfilesTable, ResumesTable } from "./schema/resume.js";
import type { UserSettingsTable, UserSourcesTable, UsersTable } from "./schema/users.js";

export interface Database {
    jobs: JobsTable;
    companies: CompaniesTable;
    verdicts: VerdictsTable;
    api_calls: ApiCallsTable;
    gmail_connection: GmailConnectionTable;
    gmail_alert_state: GmailAlertStateTable;
    careers_audit: CareersAuditTable;
    users: UsersTable;
    user_settings: UserSettingsTable;
    user_sources: UserSourcesTable;
    rescore_runs: RescoreRunsTable;
    rescore_steps: RescoreStepsTable;
    resumes: ResumesTable;
    resume_profiles: ResumeProfilesTable;
}
