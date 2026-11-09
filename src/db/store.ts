import type { AccountStore } from "./accountStore.js";
import type { AuthenticatorStore } from "./authenticatorStore.js";
import type { CompanyStore } from "./companyStore.js";
import type { KeyStore } from "./keyStore.js";
import type { MethodStore } from "./methodStore.js";
import type { PostingStore } from "./postingStore.js";
import type { SourcePlans } from "./sourcePlans.js";
import type { SessionStore } from "./sessionStore.js";
import type { TokenStore } from "./tokenStore.js";
import type { UserStores } from "./userStores.js";
import type { CareersStore } from "./careersStore.js";
import type { DescriptionFormat } from "../jobs/job.js";
import type { ApiCallLog } from "./apiCallLog.js";

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
    accounts: AccountStore;
    methods: MethodStore;
    authenticators: AuthenticatorStore;
    tokens: TokenStore;
    keys: KeyStore;
}

export interface Stores extends SharedStores {
    forUser(userId: number): UserStores;
    close(): Promise<void>;
}
