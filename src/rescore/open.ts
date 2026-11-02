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
import type { Stores } from "../db/store.js";
import type { SoughtJob } from "../careers/session.js";
import type { RescoreDeps } from "./rescore.js";

const RESCORE_LOOKUP_MINUTES = 2;

interface OpenRescore {
    deps: RescoreDeps;
    close(): Promise<void>;
}

interface LookupIo {
    logs: RunLogs;
    stores: Stores;
    chat: ChatFn;
    renderer: PageRenderer;
    markers: DataMarkers;
}

/** Opens what one re-score needs, as a run does: its settings, logs, model client and careers lookup, with a close for its page renderer. */
export async function openRescore(environment: Environment, stores: Stores): Promise<OpenRescore> {
    const loaded = loadConfig(environment);
    const logs = openRunLogs(loaded);
    const config = await settingsForRun(loaded, stores.searchSettings, logs.trace);
    const chat = createChat(config.env, logs.llm);
    const renderer = pageRenderer(config, {}, { logs, stores });
    const markers = dataMarkers(logs.runId);
    const parts = careersParts(config, { logs, stores, chat, renderer, markers });
    const now = () => new Date();
    const deps: RescoreDeps = { config, store: stores.jobStore, views: stores.jobViews, chat, trace: logs.trace, runId: logs.runId, now, markers, lookUp: (job: SoughtJob) => lookUpCareers(careersDeps(parts), [job]) };
    return { deps, close: () => renderer.close() };
}

/** Gathers the careers lookup's parts for a re-score, with its time limits capped so a re-score stays quick. */
function careersParts(config: AppConfig, { logs, stores, chat, renderer, markers }: LookupIo): CareersParts {
    const { client, boards, lookup } = runClients(config, {});
    const careers = { store: stores.careers, searxngUrl: config.env.MYJOBBOT_SEARXNG_URL ?? null, lookup, pages: client, boards, renderer };
    return { careers, settings: cappedLookup(config.settings.careers_lookup), chat, trace: logs.trace, jobs: stores.jobStore, runId: logs.runId, now: () => new Date(), http: client, markers };
}

/** Caps the careers lookup's per-job and total minutes for a re-score. */
function cappedLookup(settings: Settings["careers_lookup"]): Settings["careers_lookup"] {
    return { ...settings, max_minutes: Math.min(settings.max_minutes, RESCORE_LOOKUP_MINUTES), max_total_minutes: Math.min(settings.max_total_minutes, RESCORE_LOOKUP_MINUTES) };
}
