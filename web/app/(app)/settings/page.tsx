import type { Metadata } from "next";
import { AdminSection } from "../../../components/settings/AdminSection.js";
import { GmailPanel } from "../../../components/settings/GmailPanel.js";
import { SettingsNotices } from "../../../components/settings/SettingsNotices.js";
import { FiltersSection } from "../../../components/settings/FiltersSection.js";
import { PreferencesDraft } from "../../../components/settings/PreferencesDraft.js";
import { PreferencesSection } from "../../../components/settings/PreferencesSection.js";
import { ResumeSection } from "../../../components/settings/ResumeSection.js";
import { ScoringSection } from "../../../components/settings/ScoringSection.js";
import { SourcesSection } from "../../../components/settings/SourcesSection.js";
import { getSettingsState } from "../../../lib/settingsState.js";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** Renders the Settings page: what the stored search settings report, the saved sources, an editor for each section of the search settings, the resume, the Gmail connection and, for an admin, the admin section, even before any search settings are stored. */
export default async function SettingsPage() {
    const state = await getSettingsState();
    return (
        <main className="container-fluid" aria-label="Settings">
            <SettingsNotices notices={state.notices} />
            <SourcesSection sources={state.sources} />
            <PreferencesDraft initial={state.view.fields.preferences}>
                <PreferencesSection />
                <ResumeSection shown={state.resume} profile={state.profile} />
            </PreferencesDraft>
            <ScoringSection view={state.view} />
            <FiltersSection view={state.view} />
            <GmailPanel view={state.gmail} />
            {state.admin !== null && <AdminSection accounts={state.admin.accounts} />}
        </main>
    );
}
