"use client";

import { useState, type KeyboardEvent } from "react";
import { editedField, resetField } from "../../../src/web/settingsForm.js";
import type { SaveResult } from "../../../src/web/settingsSave.js";
import type { FieldView, SettingsView } from "../../../src/web/settingsView.js";
import { useAutoSave } from "../../lib/useAutoSave.js";
import { Panel } from "../sections/Panel.js";
import { BoostTags } from "./BoostTags.js";
import { Problems, SaveStatus, Setting, SettingCard } from "./SettingParts.js";

type Threshold = FieldView<number>;
type Boosts = FieldView<Array<[string, number]>>;

interface ThresholdProps {
    threshold: Threshold;
    result: SaveResult | null;
    onType: (threshold: Threshold) => void;
    onCommit: () => void;
    onReset: () => void;
}

/** Renders the Scoring section: the match threshold and the title boosts, saved together as soon as a boost changes or the threshold is left or reset. */
export function ScoringSection({ view }: { view: SettingsView }) {
    const scoring = useScoring(view);
    return (
        <Panel title="Scoring">
            <SettingCard title="Threshold">
                <ThresholdSetting threshold={scoring.threshold} result={scoring.result} onType={scoring.typeThreshold} onCommit={scoring.commitThreshold} onReset={scoring.resetThreshold} />
            </SettingCard>
            <SettingCard title="Boosts">
                <Setting label="Title boosts" field={scoring.boosts} onReset={() => scoring.changeBoosts(resetField(view.defaults.title_boosts))}>
                    <BoostTags boosts={scoring.boosts} result={scoring.result} onChange={scoring.changeBoosts} />
                    <Problems result={scoring.result} field="title_boosts" />
                </Setting>
            </SettingCard>
            <SaveStatus result={scoring.result} saving={scoring.saving} />
        </Panel>
    );
}

/** Keeps the Scoring section's fields and saves them: a boost change or a reset at once, a typed threshold once it is committed. */
function useScoring(view: SettingsView) {
    const [threshold, setThreshold] = useState(view.fields.match_threshold);
    const [boosts, setBoosts] = useState(view.fields.title_boosts);
    const { result, saving, autosave } = useAutoSave("scoring");
    const saveWith = (next: { threshold?: Threshold; boosts?: Boosts }) => autosave({ match_threshold: next.threshold ?? threshold, title_boosts: next.boosts ?? boosts });
    const changeBoosts = (next: Boosts) => {
        setBoosts(next);
        saveWith({ boosts: next });
    };
    const edits = useThresholdEdits({ setThreshold, defaultValue: view.defaults.match_threshold, save: (next) => saveWith({ threshold: next }) });
    return { threshold, boosts, result, saving, changeBoosts, ...edits };
}

/** Tracks a threshold being typed, saving it once it is committed, and saves a reset to the default at once. */
function useThresholdEdits({ setThreshold, defaultValue, save }: { setThreshold: (threshold: Threshold) => void; defaultValue: number; save: (threshold?: Threshold) => void }) {
    const [typed, setTyped] = useState(false);
    const typeThreshold = (next: Threshold) => {
        setThreshold(next);
        setTyped(true);
    };
    const commitThreshold = () => {
        if (typed) save();
        setTyped(false);
    };
    const resetThreshold = () => {
        const next = resetField(defaultValue);
        setThreshold(next);
        save(next);
    };
    return { typeThreshold, commitThreshold, resetThreshold };
}

/** Renders the match threshold's number field, saved when it is left or on Enter, with its problems and a reset to the default. */
function ThresholdSetting({ threshold, result, onType, onCommit, onReset }: ThresholdProps) {
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => event.key === "Enter" && onCommit();
    return (
        <Setting label="Match threshold" field={threshold} onReset={onReset}>
            <input type="number" aria-label="Match threshold" value={Number.isNaN(threshold.value) ? "" : threshold.value} onChange={(event) => onType(editedField(numberFrom(event.target.value)))} onBlur={onCommit} onKeyDown={onKeyDown} />
            <Problems result={result} field="match_threshold" />
        </Setting>
    );
}

/** Reads a number input, keeping an empty one as not-a-number so the save names the problem. */
function numberFrom(text: string): number {
    return text === "" ? Number.NaN : Number(text);
}
