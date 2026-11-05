"use client";

import { useState, type KeyboardEvent } from "react";
import { RESUME_VIEWS, type ResumeView } from "../../../src/config/schema.js";
import { editedField } from "../../../src/web/settingsForm.js";
import type { SaveResult } from "../../../src/web/settingsSave.js";
import type { BoostField } from "../../../src/web/settingsSections.js";
import type { FieldView, SettingsView } from "../../../src/web/settingsView.js";
import { useAutoSave } from "../../lib/useAutoSave.js";
import { Panel } from "../sections/Panel.js";
import { BoostCards, type BoostLists } from "./BoostCards.js";
import { Problems, SaveStatus, Setting, SettingCard } from "./SettingParts.js";

type Threshold = FieldView<number>;
type Boosts = FieldView<Array<[string, number]>>;
type View = FieldView<ResumeView>;

const VIEW_LABELS: Record<ResumeView, string> = { resume: "Your resume", resume_and_profile: "Your resume and profile", profile: "Your profile only" };

interface ThresholdProps {
    threshold: Threshold;
    result: SaveResult | null;
    onType: (threshold: Threshold) => void;
    onCommit: () => void;
}

/** Renders the Scoring section: the match threshold, what the model reads about the owner, then the title and description boosts as two cards, saved together as soon as a boost changes or the threshold is left. */
export function ScoringSection({ view }: { view: SettingsView }) {
    const scoring = useScoring(view);
    return (
        <Panel title="Scoring">
            <SettingCard title="Threshold">
                <ThresholdSetting threshold={scoring.threshold} result={scoring.result} onType={scoring.typeThreshold} onCommit={scoring.commitThreshold} />
            </SettingCard>
            <SettingCard title="About you">
                <ResumeViewSetting view={scoring.view} result={scoring.result} onChange={scoring.changeView} />
            </SettingCard>
            <BoostCards lists={scoring.lists} result={scoring.result} onChange={scoring.changeBoosts} />
            <SaveStatus result={scoring.result} saving={scoring.saving} />
        </Panel>
    );
}

/** Keeps the Scoring section's fields, the threshold, what the model reads and both boost lists, and saves them all: a boost or reading change at once, a typed threshold once it is committed. */
function useScoring(view: SettingsView) {
    const [threshold, setThreshold] = useState(view.fields.match_threshold);
    const [reads, setReads] = useState(view.fields.resume_view);
    const [lists, setLists] = useState<BoostLists>({ title_boosts: view.fields.title_boosts, description_boosts: view.fields.description_boosts });
    const { result, saving, autosave } = useAutoSave("scoring");
    const saveWith = (next: { threshold?: Threshold; lists?: BoostLists; reads?: View }) => autosave({ match_threshold: next.threshold ?? threshold, resume_view: next.reads ?? reads, ...(next.lists ?? lists) });
    const changeBoosts = (field: BoostField) => (boosts: Boosts) => {
        const next = { ...lists, [field]: boosts };
        setLists(next);
        saveWith({ lists: next });
    };
    const changeView = (next: View) => {
        setReads(next);
        saveWith({ reads: next });
    };
    const edits = useThresholdEdits(setThreshold, () => saveWith({}));
    return { threshold, view: reads, lists, result, saving, changeBoosts, changeView, ...edits };
}

/** Tracks a threshold being typed, saving it once it is committed. */
function useThresholdEdits(setThreshold: (threshold: Threshold) => void, save: () => void) {
    const [typed, setTyped] = useState(false);
    const typeThreshold = (next: Threshold) => {
        setThreshold(next);
        setTyped(true);
    };
    const commitThreshold = () => {
        if (typed) save();
        setTyped(false);
    };
    return { typeThreshold, commitThreshold };
}

/** Renders the match threshold's number field, saved when it is left or on Enter, with its problems. */
function ThresholdSetting({ threshold, result, onType, onCommit }: ThresholdProps) {
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => event.key === "Enter" && onCommit();
    return (
        <Setting label="Match threshold">
            <input type="number" aria-label="Match threshold" value={Number.isNaN(threshold.value) ? "" : threshold.value} onChange={(event) => onType(editedField(numberFrom(event.target.value)))} onBlur={onCommit} onKeyDown={onKeyDown} />
            <Problems result={result} field="match_threshold" />
        </Setting>
    );
}

/** Reads a number input, keeping an empty one as not-a-number so the save names the problem. */
function numberFrom(text: string): number {
    return text === "" ? Number.NaN : Number(text);
}

/** Renders the choice of what the scoring model reads about the owner, saved as soon as it changes. */
function ResumeViewSetting({ view, result, onChange }: { view: View; result: SaveResult | null; onChange: (view: View) => void }) {
    return (
        <Setting label="What the model reads about you">
            <select aria-label="What the model reads about you" value={view.value} onChange={(event) => onChange(editedField(RESUME_VIEWS.find((each) => each === event.target.value) ?? "resume"))}>
                {RESUME_VIEWS.map((each) => (
                    <option key={each} value={each}>
                        {VIEW_LABELS[each]}
                    </option>
                ))}
            </select>
            <Problems result={result} field="resume_view" />
        </Setting>
    );
}
