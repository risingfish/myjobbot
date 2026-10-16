import type { Trace } from "../agent/trace.js";
import type { FileConfig } from "../config/schema.js";
import type { AlertStore, ApiCallLog, GmailStore, JobStore } from "../db/store.js";
import type { ImapFactory } from "../gmail/imap.js";
import type { SecretKeyStatus } from "../gmail/secretKey.js";
import type { JsonGetter } from "../http/client.js";
import type { FetchOutcome } from "./sources.js";

interface RunState {
    finished: boolean;
    summary: string | null;
    fetches: Map<string, Promise<FetchOutcome>>;
    failedFetches: Map<string, string | null>;
}

export interface ToolContext {
    config: FileConfig;
    run: RunState;
    runId: string;
    store: JobStore;
    apiCalls: ApiCallLog;
    http: JsonGetter;
    now: () => Date;
    jobLog: Trace;
    jsearchApiKey: string | null;
    gmail: GmailAccess;
    trace: Trace;
}

interface GmailAccess {
    store: GmailStore;
    alerts: AlertStore;
    key: SecretKeyStatus;
    imap?: ImapFactory;
    usable: true | string;
}

/** Creates the empty per-run state used to track in-flight fetches, failures, and finish status. */
export function newRunState(): RunState {
    return { finished: false, summary: null, fetches: new Map(), failedFetches: new Map() };
}
