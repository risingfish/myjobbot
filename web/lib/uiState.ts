import { existsSync } from "node:fs";
import { loadFileConfig } from "../../src/config/load.js";
import { resolveSettings, settingsNotices, type SettingsNotice } from "../../src/config/resolve.js";
import type { FileConfig } from "../../src/config/schema.js";
import { splitSettings } from "../../src/config/searchSettings.js";
import { openStores } from "../../src/db/connect.js";
import { parseDbSettings, type DbSettings } from "../../src/db/settings.js";
import { OWNER_ID } from "../../src/db/searchSettingsStore.js";
import type { SavedSource } from "../../src/db/sourceStore.js";
import type { AlertStore, GmailStore, JobViews, Stores } from "../../src/db/store.js";
import { secretKeyStatus, type SecretKeyStatus } from "../../src/gmail/secretKey.js";
import { gmailSettings, settingsView, type SettingsView } from "../../src/web/settingsView.js";

interface UiState {
    views: JobViews;
    gmail: GmailStore;
    alerts: AlertStore;
    key: SecretKeyStatus;
    config: FileConfig;
    notices: SettingsNotice[];
}

interface OpenStores {
    stores: Stores;
    key: SecretKeyStatus;
}

interface SettingsState {
    gmail: GmailStore;
    alerts: AlertStore;
    key: SecretKeyStatus;
    notices: SettingsNotice[];
    view: SettingsView;
    sources: SavedSource[];
}

const cache = globalThis as typeof globalThis & { __myjobbotStores?: Promise<Stores>; __myjobbotKey?: SecretKeyStatus };

/** Returns the data folder the web UI reads its config from, from MYJOBBOT_DATA_DIR. */
function dataDir(): string {
    return process.env.MYJOBBOT_DATA_DIR ?? "data";
}

/** Reads the database settings, loading the repository's .env first when there is one (Next.js only reads web/.env). */
function dbSettings(): DbSettings {
    if (existsSync(".env")) process.loadEnvFile(".env");
    return parseDbSettings(process.env);
}

/** Returns the label the footer shows for the database, without connecting. */
export function dbLabel(): string {
    try {
        const settings = dbSettings();
        return `${settings.database} @ ${settings.host}`;
    } catch {
        return "database not configured";
    }
}

/** Returns the stores, opening them once per server process (and again after a failure) so dev reloads reuse them. */
function stores(): Promise<Stores> {
    cache.__myjobbotStores ??= openStores(dbSettings(), { tries: 1 }).catch((error: unknown) => {
        cache.__myjobbotStores = undefined;
        throw error;
    });
    return cache.__myjobbotStores;
}

/** Returns the key that seals Gmail secrets, read once per process after the stores have loaded the root .env. */
function secretKey(): SecretKeyStatus {
    cache.__myjobbotKey ??= secretKeyStatus(process.env);
    return cache.__myjobbotKey;
}

/** Returns the open stores and the sealing key without resolving any settings, for what must work before search settings are stored. */
export async function getStores(): Promise<OpenStores> {
    return { stores: await stores(), key: secretKey() };
}

/** Returns the database views, the Gmail store, the sealing key, and the settings resolved afresh for one request with what resolving them reported. */
export async function getUiState(): Promise<UiState> {
    const { stores: opened, key } = await getStores();
    const { file, notices } = await resolveSettings(loadFileConfig(dataDir()), opened.searchSettings);
    return { views: opened.jobViews, gmail: opened.gmail, alerts: opened.alerts, key, config: file, notices };
}

/** Returns what the Settings page shows for one request: the search settings in effect, what they report and the Gmail stores, without running the cross-setting rules, so it loads with nothing stored. */
export async function getSettingsState(): Promise<SettingsState> {
    const { stores: opened, key } = await getStores();
    const stored = await opened.searchSettings.load(OWNER_ID);
    const notices = settingsNotices(splitSettings(loadFileConfig(dataDir())), stored);
    const sources = await opened.sources.list(OWNER_ID);
    return { gmail: opened.gmail, alerts: opened.alerts, key, notices, view: settingsView(stored, Boolean(process.env.JSEARCH_API_KEY)), sources };
}

/** Returns config.json's runtime settings, the part a search settings save is checked against. */
export function runtimeSettings(): unknown {
    return splitSettings(loadFileConfig(dataDir())).runtime;
}

/** Returns the senders whose mail counts as a job alert, from config.json's runtime settings alone. */
export function alertSenders(): string[] {
    return gmailSettings(loadFileConfig(dataDir())).alert_senders;
}
