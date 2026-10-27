"use client";

import { useState, type ReactNode } from "react";
import { ATS_NAMES } from "../../../src/jobs/job.js";
import { addRow, blankBoard, blankSearch, removeRow, resetField, sectionRequest, updateRow } from "../../../src/web/settingsForm.js";
import type { SaveResult } from "../../../src/web/settingsSave.js";
import type { FieldView, SettingsView } from "../../../src/web/settingsView.js";
import { useSectionSave } from "../../lib/useSectionSave.js";
import { Panel } from "../sections/Panel.js";
import { Problems, SaveBar, Setting } from "./SettingParts.js";

type Entry = Record<string, unknown>;
type Entries = FieldView<Entry[]>;

interface RowProps {
    entries: Entries;
    index: number;
    onChange: (entries: Entries) => void;
}

interface EntryListProps {
    label: string;
    name: "companies" | "searches";
    entries: Entries;
    defaults: Entry[];
    blank: () => Entry;
    row: (props: RowProps) => ReactNode;
    result: SaveResult | null;
    onChange: (entries: Entries) => void;
}

const NEEDS_SOURCE = "Add a company board or a saved search: runs and the other pages need one.";
const NEEDS_SEARCH_KEY = "Saved searches need JSEARCH_API_KEY in .env; runs refuse to start without it.";

/** Renders the editable Sources section: the company boards and saved searches, saved together, with what runs still need. */
export function SourcesSection({ view }: { view: SettingsView }) {
    const [companies, setCompanies] = useState(view.fields.companies);
    const [searches, setSearches] = useState(view.fields.searches);
    const { result, save, saving, edited } = useSectionSave();
    return (
        <Panel title="Sources">
            {view.needsSource && <p className="note">{NEEDS_SOURCE}</p>}
            {view.needsSearchKey && <p className="note">{NEEDS_SEARCH_KEY}</p>}
            <form action={() => save(sectionRequest("sources", { companies, searches }))}>
                <EntryList label="Company boards" name="companies" entries={companies} defaults={view.defaults.companies} blank={blankBoard} row={BoardRow} result={result} onChange={edited(setCompanies)} />
                <EntryList label="Saved searches" name="searches" entries={searches} defaults={view.defaults.searches} blank={blankSearch} row={SearchRow} result={result} onChange={edited(setSearches)} />
                <SaveBar section="Sources" result={result} saving={saving} />
            </form>
        </Panel>
    );
}

/** Renders one list of sources: each entry with its row editor, its problems and a Remove button, then a button to add one. */
function EntryList({ label, name, entries, defaults, blank, row: Row, result, onChange }: EntryListProps) {
    return (
        <Setting label={label} field={entries} onReset={() => onChange(resetField(defaults))}>
            {entries.value.map((_entry, index) => (
                <div className="row" key={index}>
                    <Row entries={entries} index={index} onChange={onChange} />
                    <button type="button" onClick={() => onChange(removeRow(entries, index))}>
                        Remove
                    </button>
                    <Problems result={result} field={name} entry={index} />
                </div>
            ))}
            <button type="button" aria-label={`Add to ${label}`} onClick={() => onChange(addRow(entries, blank()))}>
                Add
            </button>
            <Problems result={result} field={name} />
        </Setting>
    );
}

/** Renders one company board's name, board type and board id. */
function BoardRow({ entries, index, onChange }: RowProps) {
    const board = entries.value[index] ?? {};
    const set = (key: string, value: unknown) => onChange(updateRow(entries, index, { ...board, [key]: value }));
    return (
        <>
            <input aria-label={`Board name ${index + 1}`} value={String(board.name ?? "")} onChange={(event) => set("name", event.target.value)} />
            <select aria-label={`Board type ${index + 1}`} value={String(board.ats ?? "")} onChange={(event) => set("ats", event.target.value)}>
                {ATS_NAMES.map((ats) => (
                    <option key={ats}>{ats}</option>
                ))}
            </select>
            <input aria-label={`Board id ${index + 1}`} value={String(board.slug ?? "")} onChange={(event) => set("slug", event.target.value)} />
        </>
    );
}

/** Renders one saved search's name, query, remote-only box and country, leaving remote only and country unset until changed. */
function SearchRow({ entries, index, onChange }: RowProps) {
    const search = entries.value[index] ?? {};
    const set = (key: string, value: unknown) => onChange(updateRow(entries, index, withField(search, key, value)));
    return (
        <>
            <input aria-label={`Search name ${index + 1}`} value={String(search.name ?? "")} onChange={(event) => set("name", event.target.value)} />
            <input aria-label={`Search query ${index + 1}`} value={String(search.query ?? "")} onChange={(event) => set("query", event.target.value)} />
            <label>
                <input type="checkbox" checked={search.remote_only === true} onChange={(event) => set("remote_only", event.target.checked)} /> remote only
            </label>
            <input aria-label={`Search country ${index + 1}`} placeholder="us" value={String(search.country ?? "")} onChange={(event) => set("country", event.target.value)} />
        </>
    );
}

/** Sets one field of an entry, leaving an optional text field unset when it is cleared. */
function withField(entry: Entry, key: string, value: unknown): Entry {
    const rest = Object.fromEntries(Object.entries(entry).filter(([name]) => name !== key));
    return value === "" && key === "country" ? rest : { ...entry, [key]: value };
}
