import { loadFileConfig, readResumeFile } from "../../src/config/load.js";
import { settingsNotices, type SettingsNotice } from "../../src/config/resolve.js";
import { ownsResumeFile } from "../../src/config/resumeFile.js";
import { splitSettings } from "../../src/config/searchSettings.js";
import type { Account } from "../../src/db/accountStore.js";
import type { ResumeProfile } from "../../src/db/resumeStore.js";
import type { UserStores } from "../../src/db/userStores.js";
import { keyChanged } from "../../src/gmail/connection.js";
import type { SecretKeyStatus } from "../../src/secrets/secretKey.js";
import { requestsThisMonth } from "../../src/tools/searchBudget.js";
import { gmailPanelView, type GmailPanelView } from "../../src/web/gmailPanel.js";
import { resumeShown, type ResumeShown } from "../../src/web/resumeView.js";
import { settingsView, type SettingsView } from "../../src/web/settingsView.js";
import { sourceChoices } from "../../src/web/sourceChoices.js";
import { searchUsage, sourceRows, type SourcesView } from "../../src/web/sourceRows.js";
import { dataDir, sourceConfig } from "./fileConfig.js";
import { requireSession } from "./session.js";
import { metNeeds } from "./sourceNeeds.js";
import { getStores } from "./uiState.js";

interface SettingsState {
    gmail: GmailPanelView;
    notices: SettingsNotice[];
    view: SettingsView;
    sources: SourcesView;
    resume: ResumeShown;
    profile: ResumeProfile | null;
    admin: { accounts: Account[] } | null;
}

/** Returns what the Settings page shows for one request: the search settings in effect, what they report, the resume in use, its profile, the Gmail panel and, for an admin, the accounts, without running the cross-setting rules, so it loads with nothing stored. */
export async function getSettingsState(): Promise<SettingsState> {
    const { account } = await requireSession();
    const { stores: opened, key } = await getStores();
    const admin = account.isAdmin ? { accounts: await opened.accounts.accounts() } : null;
    const stored = await opened.searchSettings.load();
    const notices = settingsNotices(splitSettings(loadFileConfig(dataDir())), stored);
    const [uploaded, profile] = await Promise.all([opened.resume.currentResume(), opened.resume.profile()]);
    const resume = resumeShown(uploaded, ownsResumeFile(opened.userId) ? readResumeFile(dataDir()) : null);
    return { gmail: await gmailView(opened, key), notices, view: settingsView(stored), sources: await sourcesView(opened), resume, profile, admin };
}

/** Builds the Sources section's view: the saved sources as rows, and this month's JSearch requests out of the cap. */
async function sourcesView(opened: UserStores): Promise<SourcesView> {
    const [saved, met, used] = await Promise.all([opened.sources.list(), metNeeds(opened), requestsThisMonth({ apiCalls: opened.apiCalls, now: () => new Date() })]);
    return { rows: sourceRows(saved, met), usage: searchUsage(used, sourceConfig().jsearch.monthly_request_cap), choices: sourceChoices(met) };
}

/** Builds the Gmail panel's view from the stored connection, the server key and the last alert run. */
async function gmailView(opened: Pick<UserStores, "gmail" | "alerts">, key: SecretKeyStatus): Promise<GmailPanelView> {
    const [row, alertState] = await Promise.all([opened.gmail.connection(), opened.alerts.state()]);
    const changed = key.status === "ok" && keyChanged({ key: key.key }, row);
    return gmailPanelView(row, { keyStatus: key.status, keyChanged: changed, alertState });
}
