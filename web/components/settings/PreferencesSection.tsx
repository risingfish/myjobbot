"use client";

import { useActionState, useState } from "react";
import { editedField, resetField, sectionRequest } from "../../../src/web/settingsForm.js";
import type { SaveResult } from "../../../src/web/settingsSave.js";
import type { SettingsView } from "../../../src/web/settingsView.js";
import { saveSettingsSection } from "../../lib/settingsActions.js";
import { Panel } from "../sections/Panel.js";
import { Problems, SaveBar, Setting } from "./SettingParts.js";

/** Renders the editable Preferences section: the free-text preferences the model reads, kept exactly as typed. */
export function PreferencesSection({ view }: { view: SettingsView }) {
    const [preferences, setPreferences] = useState(view.fields.preferences);
    const [result, save, saving] = useActionState<SaveResult | null, unknown>(saveSettingsSection, null);
    return (
        <Panel title="Preferences">
            <form action={() => save(sectionRequest("preferences", { preferences }))}>
                <Setting label="Preferences" field={preferences} onReset={() => setPreferences(resetField(view.defaults.preferences))}>
                    <textarea aria-label="Preferences" rows={6} value={preferences.value} onChange={(event) => setPreferences(editedField(event.target.value))} />
                    <Problems result={result} field="preferences" />
                </Setting>
                <SaveBar section="Preferences" result={result} saving={saving} />
            </form>
        </Panel>
    );
}
