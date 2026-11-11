import type { UserFetchHistory } from "../db/fetchHistory.js";
import type { ChatFn } from "../agent/llm.js";
import type { CompanyStore } from "../db/companyStore.js";
import type { Trace } from "../agent/trace.js";
import type { DataMarkers } from "../agent/markers.js";
import type { CareersAccess } from "../careers/deps.js";
import type { Settings } from "../config/schema.js";
import type { PostingStore } from "../db/postingStore.js";
import type { SourcePlans } from "../db/sourcePlans.js";
import type { SavedSource, UserSourceStore } from "../db/sourceStore.js";
import type { AlertStore, GmailStore } from "../db/gmailStore.js";
import type { ApiCallLog } from "../db/apiCallLog.js";
import type { JobStore } from "../db/jobStore.js";
import type { ImapFactory } from "../gmail/imap.js";
import type { SecretKeyStatus } from "../secrets/secretKey.js";
import type { JsonGetter } from "../http/client.js";
import type { SourceHttp } from "../sources/module.js";
import type { CareersSummary } from "../careers/lookUpJobs.js";
import type { AlertSummary } from "../gmail/alertFetch.js";

export interface SourceRun {
    outcome: "ok" | "partial" | "failing" | "skipped";
    reason: string | null;
    seen: string | null;
    alerts?: AlertSummary;
    careers?: CareersSummary;
}

export interface RunState {
    finished: boolean;
    summary: string | null;
    sources: Map<string, SourceRun>;
}

interface RunStores {
    store: JobStore;
    postings: PostingStore;
    sourcePlans: SourcePlans;
    apiCalls: ApiCallLog;
    companies: CompanyStore;
    saved: SavedSources;
    fetches: UserFetchHistory;
}

interface RunPorts {
    http: JsonGetter;
    sources: SourceHttp;
    now: () => Date;
    jobLog: Trace;
    trace: Trace;
    chat: ChatFn;
    careers: CareersAccess;
    gmail: GmailAccess;
}

interface RunIdentity {
    config: Settings;
    run: RunState;
    runId: string;
    markers: DataMarkers;
    jsearchApiKey: string | null;
}

export type ToolContext = RunStores & RunPorts & RunIdentity;

export interface SavedSources {
    store: UserSourceStore;
    list: SavedSource[];
}

export interface GmailAccess {
    store: GmailStore;
    alerts: AlertStore;
    key: SecretKeyStatus;
    imap: ImapFactory;
    usable: true | string;
    connected: boolean;
}

/** Creates the empty per-run state: how each source's fetch went this run, and whether the run has finished. */
export function newRunState(): RunState {
    return { finished: false, summary: null, sources: new Map() };
}
