"use client";

import { useState } from "react";
import { addTerm, removeRow } from "../../../src/web/settingsForm.js";
import type { SaveResult } from "../../../src/web/settingsSave.js";
import type { FieldView, SettingsView } from "../../../src/web/settingsView.js";
import { useAutoSave } from "../../lib/useAutoSave.js";
import { Panel } from "../sections/Panel.js";
import { Problems, SaveStatus, Setting, SettingCard } from "./SettingParts.js";
import { AddTerm, Tag, TagButton, TagCloud } from "./Tags.js";

type TermName = "include" | "exclude" | "extra_exclude" | "body_include" | "body_exclude" | "exclude_companies" | "exclude_publishers";
type Terms = FieldView<string[]>;

const LABELS: Record<TermName, string> = {
    include: "Title must include one of",
    exclude: "Title must not include",
    extra_exclude: "Also excluded",
    body_include: "Description must include one of",
    body_exclude: "Description must not include",
    exclude_companies: "Excluded companies",
    exclude_publishers: "Excluded publishers",
};

const GROUPS: Array<[string, TermName[]]> = [
    ["Title", ["include", "exclude", "extra_exclude"]],
    ["Description", ["body_include", "body_exclude"]],
    ["Other", ["exclude_companies", "exclude_publishers"]],
];

interface TermListProps {
    name: TermName;
    label: string;
    terms: Terms;
    result: SaveResult | null;
    onChange: (terms: Terms) => void;
}

/** Renders the Filters section as three groups, Title, Description and Other, each holding its lists, saved together as soon as any list changes. */
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
            <div className="grid">
                {GROUPS.map(([title, names]) => (
                    <FilterGroup key={title} title={title} lists={names.map((name) => ({ name, label: LABELS[name], terms: lists[name], result, onChange: change(name) }))} />
                ))}
            </div>
            <SaveStatus result={result} saving={saving} />
        </Panel>
    );
}

/** Renders one group of filter lists as a Pico card headed by the group's name. */
function FilterGroup({ title, lists }: { title: string; lists: TermListProps[] }) {
    return (
        <SettingCard title={title}>
            {lists.map((list) => (
                <TermList key={list.name} {...list} />
            ))}
        </SettingCard>
    );
}

/** Picks the Filters section's seven lists out of the settings view. */
function listsOf({ fields }: SettingsView): Record<TermName, Terms> {
    const { include, exclude, extra_exclude, body_include, body_exclude, exclude_companies, exclude_publishers } = fields;
    return { include, exclude, extra_exclude, body_include, body_exclude, exclude_companies, exclude_publishers };
}

/** Renders one list of terms as a cloud of tags, each removable from the button that shows when it is hovered or focused, then one field for adding a term. */
function TermList({ name, label, terms, result, onChange }: TermListProps) {
    const add = (typed: string) => {
        const next = addTerm(terms, typed);
        if (next !== terms) onChange(next);
    };
    return (
        <Setting label={label}>
            <TagCloud label={label} count={terms.value.length}>
                {terms.value.map((term, index) => (
                    <Tag key={`${index}-${term}`} text={term} problems={<Problems result={result} field={name} entry={index} />}>
                        <TagButton label={`Remove ${term} from ${label}`} symbol="×" remove onClick={() => onChange(removeRow(terms, index))} />
                    </Tag>
                ))}
            </TagCloud>
            <AddTerm label={label} onAdd={add} />
            <Problems result={result} field={name} />
        </Setting>
    );
}
