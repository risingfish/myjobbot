import type { AccountCodesTable, AuthAttemptsTable, AuthChallengesTable, EmailTokensTable, HardwareKeysTable, RecoveryCodesTable, SecurityEventsTable, SessionsTable, SignInMethodsTable } from "./schema/accounts.js";
import type { ApiCallsTable, CareersAuditTable } from "./schema/careers.js";
import type { GmailAlertStateTable, GmailConnectionTable } from "./schema/gmail.js";
import type { CompaniesTable, JobsTable, UserJobsTable, VerdictsTable } from "./schema/jobs.js";
import type { RescoreRunsTable, RescoreStepsTable } from "./schema/rescore.js";
import type { ResumeProfilesTable, ResumesTable } from "./schema/resume.js";
import type { UserSettingsTable, UserSourcesTable, UsersTable } from "./schema/users.js";

export interface Database {
    jobs: JobsTable;
    user_jobs: UserJobsTable;
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
    sign_in_methods: SignInMethodsTable;
    hardware_keys: HardwareKeysTable;
    recovery_codes: RecoveryCodesTable;
    sessions: SessionsTable;
    account_codes: AccountCodesTable;
    email_tokens: EmailTokensTable;
    auth_challenges: AuthChallengesTable;
    auth_attempts: AuthAttemptsTable;
    security_events: SecurityEventsTable;
}
