import { createChat, type ChatFn } from "../agent/llm.js";
import { dataMarkers, type DataMarkers } from "../agent/markers.js";
import { openRunLogs, type RunLogs } from "../app/runLogs.js";
import { pageRenderer, runClients } from "../app/runParts.js";
import { settingsForRun } from "../app/runSettings.js";
import { careersDeps, type CareersParts } from "../careers/deps.js";
import { lookUpCareers } from "../careers/lookUpJobs.js";
import type { PageRenderer } from "../careers/renderState.js";
import { loadConfig, type AppConfig, type Environment } from "../config/load.js";
import type { Settings } from "../config/schema.js";
import type { Trace } from "../agent/trace.js";
import type { BeginResult } from "../db/rescoreLogStore.js";
import type { JobKey } from "../db/store.js";
import type { UserStores } from "../db/userStores.js";
import type { SoughtJob } from "../careers/session.js";
import { RescoreLog } from "./log.js";
import type { RescoreDeps } from "./rescore.js";
import { loggedCareers, stepsFromTrace } from "./traceSteps.js";

const RESCORE_LOOKUP_MINUTES = 2;

export interface OpenedRescore {
    deps: RescoreDeps;
    begin(key: JobKey): Promise<BeginResult>;
    close(): Promise<void>;
}

type OnLine = (line: string, elapsedMs: number) => void;

interface LookupIo {
    logs: RunLogs;
    stores: UserStores;
    chat: ChatFn;
    renderer: PageRenderer;
    markers: DataMarkers;
    log: RescoreLog;
    trace: Trace;
}

/** Opens what one re-score needs, as a run does: its settings, logs, model client, careers lookup and step log, with a way to record the run and a close for its page renderer. */
export async function openRescore(environment: Environment, stores: UserStores, onLine?: OnLine): Promise<OpenedRescore> {
    const loaded = loadConfig(environment);
    const logs = openRunLogs(loaded);
    const fallbacks = fallbackCounter(logs.trace);
    const config = await settingsForRun(loaded, stores, fallbacks.trace);
    const log = new RescoreLog({ store: stores.rescoreLog, runId: logs.runId, startedAt: new Date(), trace: logs.trace, clock: () => new Date(), onLine });
    const trace = stepsFromTrace(logs.trace, log);
    const chat = createChat(config.env, logs.llm);
    const renderer = pageRenderer(config, {}, { logs, stores });
    const markers = dataMarkers(logs.runId);
    const parts = careersParts(config, { logs, stores, chat, renderer, markers, log, trace });
    const lookUp = (job: SoughtJob) => lookUpCareers(careersDeps(parts), [job]);
    const deps: RescoreDeps = { config, store: stores.jobStore, postings: stores.postings, views: stores.jobViews, chat, trace, runId: logs.runId, now: () => new Date(), markers, lookUp, log, fallbacks: fallbacks.count() };
    const begin = (key: JobKey) => stores.rescoreLog.begin(key, logs.runId, log.startedAt.toISOString());
    return { deps, begin, close: () => renderer.close() };
}

/** Wraps a trace to count the settings that fell back while they were resolved, leaving out other settings notices. */
function fallbackCounter(trace: Trace): { trace: Trace; count: () => number } {
    let fallbacks = 0;
    const counting: Trace = {
        write: (event) => {
            if (event.type === "settings_fallback") fallbacks += 1;
            trace.write(event);
        },
    };
    return { trace: counting, count: () => fallbacks };
}

/** Gathers the careers lookup's parts for a re-score, with its time limits capped so a re-score stays quick, and its audit rows and trace logged as steps. */
function careersParts(config: AppConfig, { logs, stores, chat, renderer, markers, log, trace }: LookupIo): CareersParts {
    const { client, boards, lookup } = runClients(config, {});
    const careers = { store: loggedCareers(stores.careers, log), searxngUrl: config.env.MYJOBBOT_SEARXNG_URL ?? null, lookup, pages: client, boards, renderer };
    return { careers, settings: cappedLookup(config.settings.careers_lookup), chat, trace, postings: stores.postings, runId: logs.runId, now: () => new Date(), http: client, markers };
}

/** Caps the careers lookup's per-job and total minutes for a re-score. */
function cappedLookup(settings: Settings["careers_lookup"]): Settings["careers_lookup"] {
    return { ...settings, max_minutes: Math.min(settings.max_minutes, RESCORE_LOOKUP_MINUTES), max_total_minutes: Math.min(settings.max_total_minutes, RESCORE_LOOKUP_MINUTES) };
}
