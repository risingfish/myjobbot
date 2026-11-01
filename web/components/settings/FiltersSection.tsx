"use client";

import { useState } from "react";
import { addRow, removeRow, resetField, sectionRequest, updateRow } from "../../../src/web/settingsForm.js";
import type { SaveResult } from "../../../src/web/settingsSave.js";
import type { FieldView, SettingsView } from "../../../src/web/settingsView.js";
import { useSectionSave } from "../../lib/useSectionSave.js";
import { Panel } from "../sections/Panel.js";
import { Problems, SaveBar, Setting } from "./SettingParts.js";

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

/** Renders the editable Filters section: the title and description filters' lists and the excluded companies and publishers, saved together. */
export function FiltersSection({ view }: { view: SettingsView }) {
    const [lists, setLists] = useState(() => listsOf(view));
    const { result, save, saving, edited } = useSectionSave();
    const change = (name: TermName) => edited((terms: Terms) => setLists((current) => ({ ...current, [name]: terms })));
    return (
        <Panel title="Filters">
            <form action={() => save(sectionRequest("filters", lists))}>
                <div className="setting-columns">
                    {LISTS.map(([name, label]) => (
                        <TermList key={name} name={name} label={label} terms={lists[name]} defaults={view.defaults[name]} result={result} onChange={change(name)} />
                    ))}
                </div>
                <SaveBar section="Filters" result={result} saving={saving} />
            </form>
        </Panel>
    );
}

/** Picks the Filters section's seven lists out of the settings view. */
function listsOf({ fields }: SettingsView): Record<TermName, Terms> {
    const { include, exclude, extra_exclude, body_include, body_exclude, exclude_companies, exclude_publishers } = fields;
    return { include, exclude, extra_exclude, body_include, body_exclude, exclude_companies, exclude_publishers };
}

/** Renders one list of terms: each term in its own field with its problems and a Remove button, then a button to add one. */
function TermList({ name, label, terms, defaults, result, onChange }: TermListProps) {
    return (
        <Setting label={label} field={terms} onReset={() => onChange(resetField(defaults))}>
            {terms.value.map((term, index) => (
                <div className="row" key={index}>
                    <input aria-label={`${label} ${index + 1}`} value={term} onChange={(event) => onChange(updateRow(terms, index, event.target.value))} />
                    <button type="button" onClick={() => onChange(removeRow(terms, index))}>
                        Remove
                    </button>
                    <Problems result={result} field={name} entry={index} />
                </div>
            ))}
            <button type="button" aria-label={`Add to ${label}`} onClick={() => onChange(addRow(terms, ""))}>
                Add
            </button>
            <Problems result={result} field={name} />
        </Setting>
    );
}
