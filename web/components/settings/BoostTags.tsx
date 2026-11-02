import { useState, type FormEvent, type KeyboardEvent } from "react";
import { putBoost, removeRow } from "../../../src/web/settingsForm.js";
import type { SaveResult } from "../../../src/web/settingsSave.js";
import type { FieldView } from "../../../src/web/settingsView.js";
import { Problems } from "./SettingParts.js";
import { Tag, TagButton, TagCloud } from "./Tags.js";

type Boosts = FieldView<Array<[string, number]>>;
type Boost = [string, number];

interface BoostListProps {
    boosts: Boosts;
    result: SaveResult | null;
    onEdit: (index: number) => void;
    onRemove: (index: number, term: string) => void;
}

const NEW_BOOST: Boost = ["", 1];

/** Renders the title boosts as tags, each with an edit and a confirmed delete, then the form that adds a boost or edits the chosen one. */
export function BoostTags({ boosts, result, onChange }: { boosts: Boosts; result: SaveResult | null; onChange: (boosts: Boosts) => void }) {
    const { editing, setEditing, remove, put } = useBoostEdits(boosts, onChange);
    return (
        <>
            <BoostList boosts={boosts} result={result} onEdit={setEditing} onRemove={remove} />
            <BoostForm key={editing ?? "new"} initial={editing === null ? NEW_BOOST : (boosts.value[editing] ?? NEW_BOOST)} editing={editing !== null} onPut={put} onCancel={() => setEditing(null)} />
        </>
    );
}

/** Tracks which boost is being edited, and puts or removes boosts, asking before a removal. */
function useBoostEdits(boosts: Boosts, onChange: (boosts: Boosts) => void) {
    const [editing, setEditing] = useState<number | null>(null);
    const remove = (index: number, term: string) => {
        if (!confirm(`Remove the boost for "${term}"?`)) return;
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
function BoostList({ boosts, result, onEdit, onRemove }: BoostListProps) {
    return (
        <TagCloud label="Title boosts" count={boosts.value.length}>
            {boosts.value.map(([term, points], index) => (
                <Tag key={`${index}-${term}`} text={`${term}: ${Number.isNaN(points) ? "?" : points}`} problems={<Problems result={result} field="title_boosts" entry={index} />}>
                    <TagButton label={`Edit the boost for ${term}`} symbol="✎" onClick={() => onEdit(index)} />
                    <TagButton label={`Remove the boost for ${term}`} symbol="×" remove onClick={() => onRemove(index, term)} />
                </Tag>
            ))}
        </TagCloud>
    );
}

/** Renders the term and points fields with Add, or Update and Cancel while a boost is being edited, as one Pico group. */
function BoostForm({ initial, editing, onPut, onCancel }: { initial: Boost; editing: boolean; onPut: (boost: Boost) => void; onCancel: () => void }) {
    const draft = useBoostDraft(initial, onPut);
    return (
        <fieldset role="group" className="boost-form">
            <input aria-label="Boost term" placeholder="Term" value={draft.term} onChange={(event) => draft.setTerm(event.target.value)} onKeyDown={draft.onKeyDown} />
            <input type="number" aria-label="Boost points" value={draft.points} onChange={(event) => draft.setPoints(event.target.value)} onKeyDown={draft.onKeyDown} />
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
