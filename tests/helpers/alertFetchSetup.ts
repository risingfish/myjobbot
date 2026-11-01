import { ALERTS_SOURCE } from "../../src/gmail/alertJobs/source.js";
import { randomBytes } from "node:crypto";
import type { Stores } from "../../src/db/store.js";
import { readAlerts, recordAlertRead, type AlertDeps, type AlertSummary } from "../../src/gmail/alertFetch.js";
import type { LookupDeps } from "../../src/gmail/alertLookupStep.js";
import type { JsonGetter } from "../../src/http/client.js";
import { testAppSettings } from "./config.js";
import type { AlertEmail } from "../../src/gmail/alertJobs/parse.js";
import { seal } from "../../src/gmail/seal.js";
import { fakeImap, type FakeImap, type FakeImapScript } from "./fakeImap.js";
import { memoryStores } from "./memoryStore.js";
import { memoryTrace } from "./trace.js";

export const KEY = randomBytes(32);
export const NOW = new Date("2026-10-16T09:00:00.000Z");
export const SENDERS = ["jobalerts-noreply@linkedin.com", "jobs-noreply@linkedin.com", "alert@indeed.com"];

export interface AlertSetup {
    deps: AlertDeps;
    stores: Stores;
    fake: FakeImap;
    trace: ReturnType<typeof memoryTrace>;
}

export async function connectedStores(stores: Stores = memoryStores()): Promise<Stores> {
    await stores.gmail.connected({ email: "me@example.com", sealedPassword: seal("apppassword", "app_password", KEY) }, NOW.toISOString());
    return stores;
}

export async function alertSetup(emails: AlertEmail[], script: FakeImapScript = {}, stores?: Stores): Promise<AlertSetup> {
    const opened = stores ?? (await connectedStores());
    const fake = fakeImap({ mailbox: { uidValidity: 7, emails }, ...script });
    const trace = memoryTrace();
    const deps: AlertDeps = { gmail: opened.gmail, alerts: opened.alerts, known: opened.jobStore, key: { status: "ok", key: KEY }, imap: fake.factory, senders: SENDERS, now: NOW, source: ALERTS_SOURCE };
    return { deps, stores: opened, fake, trace };
}

export async function fetchAlerts(setup: Pick<AlertSetup, "stores" | "trace">, deps: AlertDeps): Promise<AlertSummary> {
    const read = await readAlerts(deps);
    const at = deps.now.toISOString();
    await setup.stores.jobStore.upsertAll(read.jobs, at, deps.source);
    for (let request = 0; request < read.summary.searches; request += 1) await setup.stores.apiCalls.record("jsearch", ALERTS_SOURCE, at);
    await recordAlertRead({ jobStore: setup.stores.jobStore, alerts: setup.stores.alerts, trace: setup.trace, now: deps.now }, read);
    return read.summary;
}

export function lookupDeps(http: JsonGetter): LookupDeps {
    const config = testAppSettings();
    return { http, apiKey: "test-key", settings: config.jsearch, filters: { titleFilter: config.title_filter, excludeCompanies: config.exclude_companies }, searches: 0, usedThisMonth: 0 };
}
