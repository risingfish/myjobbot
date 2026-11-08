import { loadFileConfig, readResumeFile } from "../../src/config/load.js";
import { resolveSettings, settingsNotices, type SettingsNotice } from "../../src/config/resolve.js";
import type { Settings } from "../../src/config/schema.js";
import { splitSettings } from "../../src/config/searchSettings.js";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import { openedStores } from "./database.js";
import { requireSession } from "./session.js";
import type { RescoreLogStore } from "../../src/db/rescoreLogStore.js";
import type { ResumeProfile } from "../../src/db/resumeStore.js";
import type { Account } from "../../src/db/accountStore.js";
import type { AlertStore, GmailStore, JobViews } from "../../src/db/store.js";
import type { UserStores } from "../../src/db/userStores.js";
import { secretKeyStatus, type SecretKeyStatus } from "../../src/gmail/secretKey.js";
import { gmailConnected } from "../../src/gmail/alertJobs/usable.js";
import { requestsThisMonth } from "../../src/tools/searchBudget.js";
import { sourceNames } from "../../src/web/pageData.js";
import { resumeShown, type ResumeShown } from "../../src/web/resumeView.js";
import { gmailSettings, settingsView, sourceSettings, type SettingsView } from "../../src/web/settingsView.js";
import { sourceChoices, type Met } from "../../src/web/sourceChoices.js";
import { searchUsage, sourceRows, type SourcesView } from "../../src/web/sourceRows.js";

interface UiState {
    views: JobViews;
    rescoreLog: RescoreLogStore;
    gmail: GmailStore;
    alerts: AlertStore;
    key: SecretKeyStatus;
    config: Settings;
    notices: SettingsNotice[];
    sourceNames: string[];
}

interface OpenStores {
    stores: UserStores;
    key: SecretKeyStatus;
}

interface SettingsState {
    gmail: GmailStore;
    alerts: AlertStore;
    key: SecretKeyStatus;
    notices: SettingsNotice[];
    view: SettingsView;
    sources: SourcesView;
    resume: ResumeShown;
    profile: ResumeProfile | null;
    admin: { accounts: Account[] } | null;
}

const cache = globalThis as typeof globalThis & { __myjobbotKey?: SecretKeyStatus };

/** Returns the data folder the web UI reads its config from, from MYJOBBOT_DATA_DIR. */
function dataDir(): string {
    return process.env.MYJOBBOT_DATA_DIR ?? "data";
}

/** Returns the key that seals Gmail secrets, read once per process after the stores have loaded the root .env. */
function secretKey(): SecretKeyStatus {
    cache.__myjobbotKey ??= secretKeyStatus(process.env);
    return cache.__myjobbotKey;
}

/** Returns the open stores and the sealing key without resolving any settings, for what must work before search settings are stored. */
export async function getStores(): Promise<OpenStores> {
    return { stores: (await openedStores()).forUser(OWNER_ID), key: secretKey() };
}

/** Returns the database views, the re-score log, the Gmail store, the sealing key, and the settings resolved afresh for one request with what resolving them reported. */
export async function getUiState(): Promise<UiState> {
    await requireSession();
    const { stores: opened, key } = await getStores();
    const { settings, notices } = await resolveSettings(loadFileConfig(dataDir()), opened.searchSettings);
    const names = sourceNames(await opened.sources.list());
    return { views: opened.jobViews, rescoreLog: opened.rescoreLog, gmail: opened.gmail, alerts: opened.alerts, key, config: settings, notices, sourceNames: names };
}

/** Returns what the Settings page shows for one request: the search settings in effect, what they report, the resume in use, its profile, the Gmail stores and, for an admin, the accounts, without running the cross-setting rules, so it loads with nothing stored. */
export async function getSettingsState(): Promise<SettingsState> {
    const { account } = await requireSession();
    const { stores: opened, key } = await getStores();
    const admin = account.isAdmin ? { accounts: await opened.accounts.accounts() } : null;
    const stored = await opened.searchSettings.load();
    const notices = settingsNotices(splitSettings(loadFileConfig(dataDir())), stored);
    const [uploaded, profile] = await Promise.all([opened.resume.currentResume(), opened.resume.profile()]);
    const resume = resumeShown(uploaded, readResumeFile(dataDir()));
    return { gmail: opened.gmail, alerts: opened.alerts, key, notices, view: settingsView(stored), sources: await sourcesView(opened), resume, profile, admin };
}

/** Builds the Sources section's view: the saved sources as rows, and this month's JSearch requests out of the cap. */
async function sourcesView(opened: UserStores): Promise<SourcesView> {
    const [saved, met, used] = await Promise.all([opened.sources.list(), metNeeds(opened), requestsThisMonth({ apiCalls: opened.apiCalls, now: () => new Date() })]);
    const rows = sourceRows(saved, { hasSearchKey: met.jsearch_key, gmailConnected: met.gmail });
    return { rows, usage: searchUsage(used, sourceConfig().jsearch.monthly_request_cap), choices: sourceChoices(met) };
}

/** Returns config.json's HTTP settings and JSearch budget and schedule, which saving and testing sources use. */
export function sourceConfig(): Pick<Settings, "http" | "jsearch"> {
    return sourceSettings(loadFileConfig(dataDir()));
}

/** Reports which source requirements are set up: the JSearch key, and a Gmail connection. */
export async function metNeeds(opened: UserStores): Promise<Met> {
    return { jsearch_key: Boolean(process.env.JSEARCH_API_KEY), gmail: gmailConnected(await opened.gmail.connection()) };
}

/** Returns config.json's runtime settings, the part a search settings save is checked against. */
export function runtimeSettings(): unknown {
    return splitSettings(loadFileConfig(dataDir())).runtime;
}

/** Returns the senders whose mail counts as a job alert, from config.json's runtime settings alone. */
export function alertSenders(): string[] {
    return gmailSettings(loadFileConfig(dataDir())).alert_senders;
}
