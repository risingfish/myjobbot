import type { AccountRemoval } from "./accountRemoval.js";
import type { AccountStore } from "./accountStore.js";
import type { AttemptStore } from "./attemptStore.js";
import type { AuthenticatorStore } from "./authenticatorStore.js";
import type { CompanyStore } from "./companyStore.js";
import type { KeyStore } from "./keyStore.js";
import type { MethodStore } from "./methodStore.js";
import type { PostingStore } from "./postingStore.js";
import type { SourcePlans } from "./sourcePlans.js";
import type { SecurityEventLog } from "./securityEventLog.js";
import type { SessionStore } from "./sessionStore.js";
import type { AccountCodeStore } from "./accountCodeStore.js";
import type { EmailLinkStore } from "./emailLinkStore.js";
import type { RecoveryCodeStore } from "./recoveryCodeStore.js";
import type { UserStores } from "./userStores.js";
import type { CareersStore } from "./careersStore.js";
import type { DescriptionFormat } from "../jobs/job.js";
import type { ApiCallLog } from "./apiCallLog.js";
import type { RunHistory } from "./runHistory.js";
import type { FetchHistory } from "./fetchHistory.js";
import type { MailLog } from "./mailLog.js";
import type { MonitoringReads } from "./monitoringReads.js";

export interface FoundDescription {
    description: string;
    format: DescriptionFormat;
    url: string;
    source: "careers";
}

export interface JobKey {
    ats: string;
    jobId: string;
}

export interface CompanyPage {
    key: string;
    name: string;
    url: string;
}

export interface SharedStores {
    apiCalls: ApiCallLog;
    careers: CareersStore;
    companies: CompanyStore;
    postings: PostingStore;
    sourcePlans: SourcePlans;
    sessions: SessionStore;
    attempts: AttemptStore;
    accounts: AccountStore;
    events: SecurityEventLog;
    methods: MethodStore;
    authenticators: AuthenticatorStore;
    accountCodes: AccountCodeStore;
    emailLinks: EmailLinkStore;
    recoveryCodes: RecoveryCodeStore;
    keys: KeyStore;
    runHistory: RunHistory;
    fetchHistory: FetchHistory;
    mailLog: MailLog;
    monitoring: MonitoringReads;
}

export interface Stores extends SharedStores {
    removal: AccountRemoval;
    forUser(userId: number): UserStores;
    close(): Promise<void>;
}
