import { ALERTS_SOURCE } from "../../src/gmail/alertJobs/source.js";
import { randomBytes } from "node:crypto";
import type { Stores } from "../../src/db/store.js";
import type { AlertDeps, LookupDeps } from "../../src/gmail/alertFetch.js";
import type { JsonGetter } from "../../src/http/client.js";
import { testFileConfig } from "./config.js";
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
    const deps: AlertDeps = { gmail: opened.gmail, alerts: opened.alerts, store: opened.jobStore, key: { status: "ok", key: KEY }, imap: fake.factory, senders: SENDERS, trace, now: NOW, source: ALERTS_SOURCE };
    return { deps, stores: opened, fake, trace };
}

export function lookupDeps(http: JsonGetter, stores: Stores): LookupDeps {
    const config = testFileConfig();
    return { http, apiKey: "test-key", settings: config.jsearch, apiCalls: stores.apiCalls, filters: { titleFilter: config.title_filter, excludeCompanies: config.exclude_companies }, searches: 0, usedThisMonth: 0 };
}
