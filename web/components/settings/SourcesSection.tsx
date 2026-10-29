import type { SourceRowView } from "../../../src/web/sourceRows.js";
import { Panel } from "../sections/Panel.js";

const NO_SOURCES = "No saved sources yet.";

/** Renders the Sources section: the owner's saved sources, read-only for now, each with its type, whether it is on, and what stops it being fetched. */
export function SourcesSection({ rows }: { rows: SourceRowView[] }) {
    return (
        <Panel title="Sources">
            {rows.length === 0 ? (
                <p className="note">{NO_SOURCES}</p>
            ) : (
                <ul aria-label="Saved sources">
                    {rows.map((row) => (
                        <li key={row.id}>
                            {row.module}: {row.name}
                            {row.on ? "" : " (off)"}
                            {row.note === null ? "" : ` — ${row.note}`}
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
