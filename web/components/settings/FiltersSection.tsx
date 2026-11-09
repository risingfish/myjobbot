"use client";

import { useState } from "react";
import { addTerm, removeRow } from "../../../src/web/settingsForm.js";
import type { SaveResult } from "../../../src/web/settingsSave.js";
import { FILTER_FIELDS, type FilterField } from "../../../src/web/settingsSections.js";
import type { FieldView, SettingsView } from "../../../src/web/settingsView.js";
import { useAutoSave } from "../../lib/useAutoSave.js";
import { Panel } from "../sections/Panel.js";
import { Problems, SaveStatus, Setting, SettingCard } from "./SettingParts.js";
import { AddTerm, Tag, TagButton, TagCloud } from "./Tags.js";

type Terms = FieldView<string[]>;

const GROUP_TITLES = ["Title", "Description", "Other"] as const;

const LABELS: Record<FilterField, string> = {
    include: "Title must include one of",
    exclude: "Title must not include",
    extra_exclude: "Also excluded",
    body_include: "Description must include one of",
    body_exclude: "Description must not include",
    exclude_companies: "Excluded companies",
    exclude_publishers: "Excluded publishers",
};

const GROUP_OF: Record<FilterField, (typeof GROUP_TITLES)[number]> = {
    include: "Title",
    exclude: "Title",
    extra_exclude: "Title",
    body_include: "Description",
    body_exclude: "Description",
    exclude_companies: "Other",
    exclude_publishers: "Other",
};

const GROUPS = GROUP_TITLES.map((title) => [title, FILTER_FIELDS.filter((name) => GROUP_OF[name] === title)] as const);

interface TermListProps {
    name: FilterField;
    label: string;
    terms: Terms;
    result: SaveResult | null;
    onChange: (terms: Terms) => void;
}

/** Renders the Filters section as three groups, Title, Description and Other, each holding its lists, saved together as soon as any list changes. */
export function FiltersSection({ view }: { view: SettingsView }) {
    const [lists, setLists] = useState(() => listsOf(view));
    const { result, saving, autosave } = useAutoSave("filters");
    const change = (name: FilterField) => (terms: Terms) => {
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
function listsOf({ fields }: SettingsView): Record<FilterField, Terms> {
    return Object.fromEntries(FILTER_FIELDS.map((name) => [name, fields[name]])) as Record<FilterField, Terms>;
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
