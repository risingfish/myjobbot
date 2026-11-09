import { loadFileConfig } from "../../src/config/load.js";
import { resolveSettings, type SettingsNotice } from "../../src/config/resolve.js";
import type { Settings } from "../../src/config/schema.js";
import type { JobViews } from "../../src/db/jobViews.js";
import type { RescoreLogStore } from "../../src/db/rescoreLogStore.js";
import type { UserStores } from "../../src/db/userStores.js";
import { secretKeyStatus, type SecretKeyStatus } from "../../src/secrets/secretKey.js";
import { sourceNames } from "../../src/web/pageData.js";
import { dataDir } from "./fileConfig.js";
import { myStores } from "./myStores.js";
import { requireSession } from "./session.js";

interface UiState {
    views: JobViews;
    rescoreLog: RescoreLogStore;
    config: Settings;
    notices: SettingsNotice[];
    sourceNames: string[];
}

interface OpenStores {
    stores: UserStores;
    key: SecretKeyStatus;
}

const cache = globalThis as typeof globalThis & { __myjobbotKey?: SecretKeyStatus };

/** Returns the key that seals Gmail secrets, read once per process after the stores have loaded the root .env. */
function secretKey(): SecretKeyStatus {
    cache.__myjobbotKey ??= secretKeyStatus(process.env);
    return cache.__myjobbotKey;
}

/** Returns the signed-in user's stores and the sealing key without resolving any settings, for what must work before search settings are stored. */
export async function getStores(): Promise<OpenStores> {
    return { stores: await myStores(), key: secretKey() };
}

/** Returns the database views, the re-score log, and the settings resolved afresh for one request with what resolving them reported. */
export async function getUiState(): Promise<UiState> {
    await requireSession();
    const { stores: opened } = await getStores();
    const { settings, notices } = await resolveSettings(loadFileConfig(dataDir()), opened.searchSettings);
    const names = sourceNames(await opened.sources.list());
    return { views: opened.jobViews, rescoreLog: opened.rescoreLog, config: settings, notices, sourceNames: names };
}
