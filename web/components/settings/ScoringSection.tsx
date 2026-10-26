"use client";

import { useActionState, useState } from "react";
import { addRow, editedField, removeRow, resetField, sectionRequest, updateRow } from "../../../src/web/settingsForm.js";
import type { SaveResult } from "../../../src/web/settingsSave.js";
import type { FieldView, SettingsView } from "../../../src/web/settingsView.js";
import { saveSettingsSection } from "../../lib/settingsActions.js";
import { Panel } from "../sections/Panel.js";
import { Problems, SaveBar, Setting } from "./SettingParts.js";

type Boosts = FieldView<Array<[string, number]>>;

/** Renders the editable Scoring section: the match threshold and the title boosts, saved together. */
export function ScoringSection({ view }: { view: SettingsView }) {
    const [threshold, setThreshold] = useState(view.fields.match_threshold);
    const [boosts, setBoosts] = useState(view.fields.title_boosts);
    const [result, save, saving] = useActionState<SaveResult | null, unknown>(saveSettingsSection, null);
    return (
        <Panel title="Scoring">
            <form action={() => save(sectionRequest("scoring", { match_threshold: threshold, title_boosts: boosts }))}>
                <Setting label="Match threshold" field={threshold} onReset={() => setThreshold(resetField(view.defaults.match_threshold))}>
                    <input type="number" aria-label="Match threshold" value={Number.isNaN(threshold.value) ? "" : threshold.value} onChange={(event) => setThreshold(editedField(numberFrom(event.target.value)))} />
                    <Problems result={result} field="match_threshold" />
                </Setting>
                <Setting label="Title boosts" field={boosts} onReset={() => setBoosts(resetField(view.defaults.title_boosts))}>
                    <BoostRows boosts={boosts} result={result} onChange={setBoosts} />
                    <Problems result={result} field="title_boosts" />
                </Setting>
                <SaveBar section="Scoring" result={result} saving={saving} />
            </form>
        </Panel>
    );
}

/** Renders the title boosts as rows of term and points, each removable, with a row to add. */
function BoostRows({ boosts, result, onChange }: { boosts: Boosts; result: SaveResult | null; onChange: (boosts: Boosts) => void }) {
    return (
        <>
            {boosts.value.map(([term, points], index) => (
                <div className="row" key={index}>
                    <input aria-label={`Boost term ${index + 1}`} value={term} onChange={(event) => onChange(updateRow(boosts, index, [event.target.value, points]))} />
                    <input type="number" aria-label={`Boost points ${index + 1}`} value={Number.isNaN(points) ? "" : points} onChange={(event) => onChange(updateRow(boosts, index, [term, numberFrom(event.target.value)]))} />
                    <button type="button" onClick={() => onChange(removeRow(boosts, index))}>
                        Remove
                    </button>
                    <Problems result={result} field="title_boosts" entry={index} />
                </div>
            ))}
            <button type="button" onClick={() => onChange(addRow(boosts, ["", 10]))}>
                Add a boost
            </button>
        </>
    );
}

/** Reads a number input, keeping an empty one as not-a-number so the save names the problem. */
function numberFrom(text: string): number {
    return text === "" ? Number.NaN : Number(text);
}
