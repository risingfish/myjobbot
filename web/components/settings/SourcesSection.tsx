import type { SourceRowView, SourcesView } from "../../../src/web/sourceRows.js";
import { Panel } from "../sections/Panel.js";
import { DeleteSource, SourceSwitch } from "./SourceControls.js";

const NO_SOURCES = "No saved sources yet.";

/** Renders the Sources section: this month's JSearch requests, then the owner's saved sources, each with its switch, last fetch and Delete. */
export function SourcesSection({ sources }: { sources: SourcesView }) {
    return (
        <Panel title="Sources">
            <p className="note">{sources.usage}</p>
            {sources.rows.length === 0 ? (
                <p className="note">{NO_SOURCES}</p>
            ) : (
                <ul aria-label="Saved sources">
                    {sources.rows.map((row) => (
                        <SourceRow key={row.id} row={row} />
                    ))}
                </ul>
            )}
        </Panel>
    );
}

/** Renders one saved source: its module as a badge, its name, its switch, its last fetch and what stops it, and Delete unless it belongs to the account. */
function SourceRow({ row }: { row: SourceRowView }) {
    return (
        <li className="source-row">
            <span className="badge">{row.module}</span>
            <strong>{row.name}</strong>
            <SourceSwitch row={row} />
            {row.last === null ? null : <small className="note">Last fetch {row.last}</small>}
            {row.note === null ? null : <small className="note">{row.note}</small>}
            {row.account ? null : <DeleteSource row={row} />}
        </li>
    );
}
