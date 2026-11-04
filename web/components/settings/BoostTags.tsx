import { useState, type FormEvent, type KeyboardEvent } from "react";
import { putBoost, removeRow } from "../../../src/web/settingsForm.js";
import type { SaveResult } from "../../../src/web/settingsSave.js";
import type { BoostField } from "../../../src/web/settingsSections.js";
import type { FieldView } from "../../../src/web/settingsView.js";
import { Problems } from "./SettingParts.js";
import { Tag, TagButton, TagCloud } from "./Tags.js";

type Boosts = FieldView<Array<[string, number]>>;
type Boost = [string, number];

interface BoostTagsProps {
    field: BoostField;
    label: string;
    boosts: Boosts;
    result: SaveResult | null;
    onChange: (boosts: Boosts) => void;
}

interface BoostListProps {
    field: BoostField;
    label: string;
    boosts: Boosts;
    result: SaveResult | null;
    onEdit: (index: number) => void;
    onRemove: (index: number, term: string) => void;
}

const NEW_BOOST: Boost = ["", 1];

const NAMES: Record<BoostField, string> = { title_boosts: "title boost", description_boosts: "description boost" };

/** Renders one boost list as tags, each with an edit and a confirmed delete, then the form that adds a boost or edits the chosen one, every control named for its list. */
export function BoostTags({ field, label, boosts, result, onChange }: BoostTagsProps) {
    const { editing, setEditing, remove, put } = useBoostEdits(boosts, onChange, NAMES[field]);
    return (
        <>
            <BoostList field={field} label={label} boosts={boosts} result={result} onEdit={setEditing} onRemove={remove} />
            <BoostForm key={editing ?? "new"} name={NAMES[field]} initial={editing === null ? NEW_BOOST : (boosts.value[editing] ?? NEW_BOOST)} editing={editing !== null} onPut={put} onCancel={() => setEditing(null)} />
        </>
    );
}

/** Tracks which boost is being edited, and puts or removes boosts, asking before a removal and naming the list in the question. */
function useBoostEdits(boosts: Boosts, onChange: (boosts: Boosts) => void, name: string) {
    const [editing, setEditing] = useState<number | null>(null);
    const remove = (index: number, term: string) => {
        if (!confirm(`Remove the ${name} for "${term}"?`)) return;
        setEditing(null);
        onChange(removeRow(boosts, index));
    };
    const put = (boost: Boost) => {
        const next = putBoost(boosts, boost, editing);
        setEditing(null);
        if (next !== boosts) onChange(next);
    };
    return { editing, setEditing, remove, put };
}

/** Renders each boost as a tag reading "term: points", with its edit and delete buttons and the problems a refused save found with it. */
function BoostList({ field, label, boosts, result, onEdit, onRemove }: BoostListProps) {
    const name = NAMES[field];
    return (
        <TagCloud label={label} count={boosts.value.length}>
            {boosts.value.map(([term, points], index) => (
                <Tag key={`${index}-${term}`} text={`${term}: ${Number.isNaN(points) ? "?" : points}`} problems={<Problems result={result} field={field} entry={index} />}>
                    <TagButton label={`Edit the ${name} for ${term}`} symbol="✎" onClick={() => onEdit(index)} />
                    <TagButton label={`Remove the ${name} for ${term}`} symbol="×" remove onClick={() => onRemove(index, term)} />
                </Tag>
            ))}
        </TagCloud>
    );
}

/** Renders the term and points fields with Add, or Update and Cancel while a boost is being edited, as one Pico group labelled for its list. */
function BoostForm({ name, initial, editing, onPut, onCancel }: { name: string; initial: Boost; editing: boolean; onPut: (boost: Boost) => void; onCancel: () => void }) {
    const draft = useBoostDraft(initial, onPut);
    const named = name.charAt(0).toUpperCase() + name.slice(1);
    return (
        <fieldset role="group" className="boost-form">
            <input aria-label={`${named} term`} placeholder="Term" value={draft.term} onChange={(event) => draft.setTerm(event.target.value)} onKeyDown={draft.onKeyDown} />
            <input type="number" aria-label={`${named} points`} value={draft.points} onChange={(event) => draft.setPoints(event.target.value)} onKeyDown={draft.onKeyDown} />
            <button type="button" className="secondary" onClick={() => draft.put()}>
                {editing ? "Update" : "Add"}
            </button>
            {editing && (
                <button type="button" className="secondary outline" onClick={onCancel}>
                    Cancel
                </button>
            )}
        </fieldset>
    );
}

/** Keeps the boost being typed, and puts it on the button or on Enter, instead of saving the section, then clears the fields. */
function useBoostDraft(initial: Boost, onPut: (boost: Boost) => void) {
    const [term, setTerm] = useState(initial[0]);
    const [points, setPoints] = useState(Number.isNaN(initial[1]) ? "" : String(initial[1]));
    const put = (event?: FormEvent | KeyboardEvent) => {
        event?.preventDefault();
        onPut([term, points === "" ? Number.NaN : Number(points)]);
        setTerm("");
        setPoints(String(NEW_BOOST[1]));
    };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => event.key === "Enter" && put(event);
    return { term, setTerm, points, setPoints, put, onKeyDown };
}
