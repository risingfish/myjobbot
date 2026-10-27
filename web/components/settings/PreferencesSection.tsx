"use client";

import { useState } from "react";
import { editedField, resetField, sectionRequest } from "../../../src/web/settingsForm.js";
import type { SettingsView } from "../../../src/web/settingsView.js";
import { useSectionSave } from "../../lib/useSectionSave.js";
import { Panel } from "../sections/Panel.js";
import { Problems, SaveBar, Setting } from "./SettingParts.js";

/** Renders the editable Preferences section: the free-text preferences the model reads, kept exactly as typed. */
export function PreferencesSection({ view }: { view: SettingsView }) {
    const [preferences, setPreferences] = useState(view.fields.preferences);
    const { result, save, saving, edited } = useSectionSave();
    const change = edited(setPreferences);
    return (
        <Panel title="Preferences">
            <form action={() => save(sectionRequest("preferences", { preferences }))}>
                <Setting label="Preferences" field={preferences} onReset={() => change(resetField(view.defaults.preferences))}>
                    <textarea aria-label="Preferences" rows={6} value={preferences.value} onChange={(event) => change(editedField(event.target.value))} />
                    <Problems result={result} field="preferences" />
                </Setting>
                <SaveBar section="Preferences" result={result} saving={saving} />
            </form>
        </Panel>
    );
}
