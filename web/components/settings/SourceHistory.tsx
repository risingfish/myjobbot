import type { FetchLineView } from "../../../src/web/sourceRows.js";
import { DataTable } from "../sections/DataTable.js";

const RECENT = "Recent fetches";
const HEADINGS = ["When", "Outcome", "Jobs"];

/** Renders a source's recent fetches in a closed-by-default list, with a mark when its latest 3 failed. */
export function SourceHistory({ history, failing }: { history: FetchLineView[]; failing: boolean }) {
    if (history.length === 0) return null;
    const rows = history.map((line, index) => ({ key: `${line.when}-${index}`, cells: [line.when, line.outcome, line.jobs] }));
    return (
        <details>
            <summary>
                {RECENT}
                {failing ? <mark>Failing repeatedly</mark> : null}
            </summary>
            <DataTable label={RECENT} headings={HEADINGS} rows={rows} />
        </details>
    );
}
