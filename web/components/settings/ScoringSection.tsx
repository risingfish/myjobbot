"use client";

import { useState } from "react";
import { addRow, editedField, removeRow, resetField, sectionRequest, updateRow } from "../../../src/web/settingsForm.js";
import type { SaveResult } from "../../../src/web/settingsSave.js";
import type { FieldView, SettingsView } from "../../../src/web/settingsView.js";
import { useSectionSave } from "../../lib/useSectionSave.js";
import { Panel } from "../sections/Panel.js";
import { Problems, SaveBar, Setting } from "./SettingParts.js";

type Boosts = FieldView<Array<[string, number]>>;

/** Renders the editable Scoring section: the match threshold and the title boosts, saved together. */
export function ScoringSection({ view }: { view: SettingsView }) {
    const [threshold, setThreshold] = useState(view.fields.match_threshold);
    const [boosts, setBoosts] = useState(view.fields.title_boosts);
    const { result, save, saving, edited } = useSectionSave();
    const changeThreshold = edited(setThreshold);
    const changeBoosts = edited(setBoosts);
    return (
        <Panel title="Scoring">
            <form action={() => save(sectionRequest("scoring", { match_threshold: threshold, title_boosts: boosts }))}>
                <ThresholdSetting threshold={threshold} defaultValue={view.defaults.match_threshold} result={result} onChange={changeThreshold} />
                <Setting label="Title boosts" field={boosts} onReset={() => changeBoosts(resetField(view.defaults.title_boosts))}>
                    <BoostRows boosts={boosts} result={result} onChange={changeBoosts} />
                    <Problems result={result} field="title_boosts" />
                </Setting>
                <SaveBar section="Scoring" result={result} saving={saving} />
            </form>
        </Panel>
    );
}

/** Renders the match threshold's number field, with its problems and a reset to the default. */
function ThresholdSetting({ threshold, defaultValue, result, onChange }: { threshold: FieldView<number>; defaultValue: number; result: SaveResult | null; onChange: (threshold: FieldView<number>) => void }) {
    return (
        <Setting label="Match threshold" field={threshold} onReset={() => onChange(resetField(defaultValue))}>
            <input type="number" aria-label="Match threshold" value={Number.isNaN(threshold.value) ? "" : threshold.value} onChange={(event) => onChange(editedField(numberFrom(event.target.value)))} />
            <Problems result={result} field="match_threshold" />
        </Setting>
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
