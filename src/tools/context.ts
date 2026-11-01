import type { ChatFn } from "../agent/llm.js";
import type { CompanyStore } from "../db/companyStore.js";
import type { Trace } from "../agent/trace.js";
import type { DataMarkers } from "../agent/markers.js";
import type { HostLookup } from "../careers/fetchPage.js";
import type { PageRenderer } from "../careers/renderState.js";
import type { Settings } from "../config/schema.js";
import type { SavedSource, SourceStore } from "../db/sourceStore.js";
import type { AlertStore, ApiCallLog, CareersStore, GmailStore, JobStore } from "../db/store.js";
import type { ImapFactory } from "../gmail/imap.js";
import type { SecretKeyStatus } from "../gmail/secretKey.js";
import type { JsonGetter, JsonPoster, TextGetter } from "../http/client.js";
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

interface RunState {
    finished: boolean;
    summary: string | null;
    sources: Map<string, SourceRun>;
}

export interface ToolContext {
    config: Settings;
    run: RunState;
    runId: string;
    store: JobStore;
    apiCalls: ApiCallLog;
    http: JsonGetter;
    sources: SourceHttp;
    saved: SavedSources;
    now: () => Date;
    jobLog: Trace;
    jsearchApiKey: string | null;
    gmail: GmailAccess;
    trace: Trace;
    chat: ChatFn;
    careers: CareersAccess;
    companies: CompanyStore;
    markers: DataMarkers;
}

interface SavedSources {
    store: SourceStore;
    list: SavedSource[];
}

interface CareersAccess {
    store: CareersStore;
    searxngUrl: string | null;
    lookup: HostLookup;
    pages: TextGetter;
    boards: JsonGetter & JsonPoster;
    renderer: PageRenderer;
}

interface GmailAccess {
    store: GmailStore;
    alerts: AlertStore;
    key: SecretKeyStatus;
    imap?: ImapFactory;
    usable: true | string;
    connected: boolean;
}

/** Creates the empty per-run state: how each source's fetch went this run, and whether the run has finished. */
export function newRunState(): RunState {
    return { finished: false, summary: null, sources: new Map() };
}
