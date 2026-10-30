"use client";

import { useState } from "react";
import type { SourceDraft } from "../../../src/web/sourceForm.js";
import type { SourceRowView, SourcesView } from "../../../src/web/sourceRows.js";
import { Panel } from "../sections/Panel.js";
import { AddSource } from "./AddSource.js";
import { DeleteSource, SourceSwitch } from "./SourceControls.js";
import { SourceEditor } from "./SourceEditor.js";

const NO_SOURCES = "No saved sources yet.";

/** Renders the Sources section: this month's JSearch requests, the owner's saved sources, and adding a source or editing one in its form. */
export function SourcesSection({ sources }: { sources: SourcesView }) {
    const [draft, setDraft] = useState<SourceDraft | null>(null);
    const choice = sources.choices.find((each) => each.id === draft?.module);
    return (
        <Panel title="Sources">
            <p className="note">{sources.usage}</p>
            {sources.rows.length === 0 ? (
                <p className="note">{NO_SOURCES}</p>
            ) : (
                <ul aria-label="Saved sources">
                    {sources.rows.map((row) => (
                        <SourceRow key={row.id} row={row} onEdit={setDraft} />
                    ))}
                </ul>
            )}
            {draft === null || choice === undefined ? <AddSource choices={sources.choices} onOpen={setDraft} /> : <SourceEditor key={`${draft.id ?? "new"}-${draft.module}`} choice={choice} draft={draft} onClose={() => setDraft(null)} />}
        </Panel>
    );
}

/** Renders one saved source: its module as a badge, its name, its switch, its last fetch and what stops it, and Edit and Delete unless it belongs to the account. */
function SourceRow({ row, onEdit }: { row: SourceRowView; onEdit: (draft: SourceDraft) => void }) {
    const { edit } = row;
    return (
        <li className="source-row">
            <span className="badge">{row.module}</span>
            <strong>{row.name}</strong>
            <SourceSwitch row={row} />
            {row.last === null ? null : <small className="note">Last fetch {row.last}</small>}
            {row.note === null ? null : <small className="note">{row.note}</small>}
            {edit === null ? null : (
                <button type="button" onClick={() => onEdit(edit)}>
                    Edit
                </button>
            )}
            {row.account ? null : <DeleteSource row={row} />}
        </li>
    );
}
