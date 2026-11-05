"use client";

import { editedField, sectionRequest } from "../../../src/web/settingsForm.js";
import { useSectionSave } from "../../lib/useSectionSave.js";
import { Panel } from "../sections/Panel.js";
import { usePreferencesDraft } from "./PreferencesDraft.js";
import { Problems, SaveBar, Setting } from "./SettingParts.js";

/** Renders the editable Preferences section: the free-text preferences the model reads, kept exactly as typed, its text shared with the Resume section's summary. */
export function PreferencesSection() {
    const { preferences, setPreferences } = usePreferencesDraft();
    const { result, save, saving, edited } = useSectionSave();
    const change = edited(setPreferences);
    return (
        <Panel title="Preferences">
            <form action={() => save(sectionRequest("preferences", { preferences }))}>
                <Setting label="Preferences">
                    <textarea id="preferences" aria-label="Preferences" rows={6} value={preferences.value} onChange={(event) => change(editedField(event.target.value))} />
                    <Problems result={result} field="preferences" />
                </Setting>
                <SaveBar section="Preferences" result={result} saving={saving} />
            </form>
        </Panel>
    );
}
