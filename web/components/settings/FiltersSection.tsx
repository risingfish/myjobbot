"use client";

import { useState, type KeyboardEvent } from "react";
import { addTerm, removeRow, resetField } from "../../../src/web/settingsForm.js";
import type { SaveResult } from "../../../src/web/settingsSave.js";
import type { FieldView, SettingsView } from "../../../src/web/settingsView.js";
import { useAutoSave } from "../../lib/useAutoSave.js";
import { Panel } from "../sections/Panel.js";
import { Problems, SaveStatus, Setting } from "./SettingParts.js";
import { Tag, TagButton } from "./Tags.js";

type TermName = "include" | "exclude" | "extra_exclude" | "body_include" | "body_exclude" | "exclude_companies" | "exclude_publishers";
type Terms = FieldView<string[]>;

const LISTS: Array<[TermName, string]> = [
    ["include", "Title must include one of"],
    ["exclude", "Title must not include"],
    ["extra_exclude", "Also excluded"],
    ["body_include", "Description must include one of"],
    ["body_exclude", "Description must not include"],
    ["exclude_companies", "Excluded companies"],
    ["exclude_publishers", "Excluded publishers"],
];

interface TermListProps {
    name: TermName;
    label: string;
    terms: Terms;
    defaults: string[];
    result: SaveResult | null;
    onChange: (terms: Terms) => void;
}

/** Renders the Filters section: the title and description filters' lists and the excluded companies and publishers, saved together as soon as any list changes. */
export function FiltersSection({ view }: { view: SettingsView }) {
    const [lists, setLists] = useState(() => listsOf(view));
    const { result, saving, autosave } = useAutoSave("filters");
    const change = (name: TermName) => (terms: Terms) => {
        const next = { ...lists, [name]: terms };
        setLists(next);
        autosave(next);
    };
    return (
        <Panel title="Filters">
            <div className="setting-columns">
                {LISTS.map(([name, label]) => (
                    <TermList key={name} name={name} label={label} terms={lists[name]} defaults={view.defaults[name]} result={result} onChange={change(name)} />
                ))}
            </div>
            <SaveStatus result={result} saving={saving} />
        </Panel>
    );
}

/** Picks the Filters section's seven lists out of the settings view. */
function listsOf({ fields }: SettingsView): Record<TermName, Terms> {
    const { include, exclude, extra_exclude, body_include, body_exclude, exclude_companies, exclude_publishers } = fields;
    return { include, exclude, extra_exclude, body_include, body_exclude, exclude_companies, exclude_publishers };
}

/** Renders one list of terms as a cloud of tags, each removable from the button that shows when it is hovered or focused, then one field for adding a term. */
function TermList({ name, label, terms, defaults, result, onChange }: TermListProps) {
    const add = (typed: string) => {
        const next = addTerm(terms, typed);
        if (next !== terms) onChange(next);
    };
    return (
        <Setting label={label} field={terms} onReset={() => onChange(resetField(defaults))}>
            <ul className="tags" aria-label={label}>
                {terms.value.map((term, index) => (
                    <Tag key={`${index}-${term}`} text={term} problems={<Problems result={result} field={name} entry={index} />}>
                        <TagButton label={`Remove ${term} from ${label}`} symbol="×" remove onClick={() => onChange(removeRow(terms, index))} />
                    </Tag>
                ))}
            </ul>
            <AddTerm label={label} onAdd={add} />
            <Problems result={result} field={name} />
        </Setting>
    );
}

/** Renders the field for adding a term to a list, joined to its Add button as a Pico group; Enter adds too. */
function AddTerm({ label, onAdd }: { label: string; onAdd: (typed: string) => void }) {
    const [typed, setTyped] = useState("");
    const add = () => {
        onAdd(typed);
        setTyped("");
    };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        add();
    };
    return (
        <fieldset role="group">
            <input aria-label={`New term for ${label}`} placeholder="Add a term" value={typed} onChange={(event) => setTyped(event.target.value)} onKeyDown={onKeyDown} />
            <button type="button" className="secondary" aria-label={`Add to ${label}`} onClick={add}>
                Add
            </button>
        </fieldset>
    );
}
