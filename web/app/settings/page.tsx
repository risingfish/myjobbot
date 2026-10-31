import type { Metadata } from "next";
import { keyChanged } from "../../../src/gmail/connection.js";
import { gmailPanelView, type GmailPanelView } from "../../../src/web/gmailPanel.js";
import { GmailPanel } from "../../components/settings/GmailPanel.js";
import { SettingsNotices } from "../../components/settings/SettingsNotices.js";
import { FiltersSection } from "../../components/settings/FiltersSection.js";
import { PreferencesSection } from "../../components/settings/PreferencesSection.js";
import { ScoringSection } from "../../components/settings/ScoringSection.js";
import { SourcesSection } from "../../components/settings/SourcesSection.js";
import { getSettingsState } from "../../lib/uiState.js";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

type SettingsState = Awaited<ReturnType<typeof getSettingsState>>;

/** Renders the Settings page: what the stored search settings report, the saved sources, an editor for each section of the search settings, and the Gmail connection, even before any search settings are stored. */
export default async function SettingsPage() {
    const state = await getSettingsState();
    return (
        <main className="container-fluid" aria-label="Settings">
            <SettingsNotices notices={state.notices} />
            <SourcesSection sources={state.sources} />
            <PreferencesSection view={state.view} />
            <ScoringSection view={state.view} />
            <FiltersSection view={state.view} />
            <GmailPanel view={await gmailView(state)} />
        </main>
    );
}

/** Builds the Gmail panel's view from the stored connection, the server key and the last alert run. */
async function gmailView({ gmail, alerts, key }: Pick<SettingsState, "gmail" | "alerts" | "key">): Promise<GmailPanelView> {
    const [row, alertState] = await Promise.all([gmail.connection(), alerts.state()]);
    const changed = key.status === "ok" && keyChanged({ key: key.key }, row);
    return gmailPanelView(row, { keyStatus: key.status, keyChanged: changed, alertState });
}
