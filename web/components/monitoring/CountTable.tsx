import type { CountRow } from "../../../src/web/counts.js";
import { DataTable } from "../sections/DataTable.js";

/** Renders counts as a labelled two-column table: what was counted, and how many. */
export function CountTable({ label, heading, rows }: { label: string; heading: string; rows: CountRow[] }) {
    return <DataTable label={label} headings={[heading, "Count"]} rows={rows.map((row) => ({ key: row.label, cells: [row.label, row.count] }))} />;
}
