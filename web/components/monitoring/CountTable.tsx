import type { ReactNode } from "react";
import type { CountRow } from "../../../src/web/counts.js";
import { DataTable } from "../sections/DataTable.js";
import { SettingCard } from "../settings/SettingParts.js";

interface CountCardProps {
    title: string;
    label: string;
    heading: string;
    rows: CountRow[];
}

/** Renders counts as a labelled two-column table: what was counted, and how many. */
function CountTable({ label, heading, rows }: Omit<CountCardProps, "title">) {
    return <DataTable label={label} headings={[heading, "Count"]} rows={rows.map((row) => ({ key: row.label, cells: [row.label, row.count] }))} />;
}

/** Gives a section's card of counts under its title, or null when there is nothing to count, so the section's grid leaves it out. */
export function countCard(card: CountCardProps): ReactNode {
    if (card.rows.length === 0) return null;
    return (
        <SettingCard key={card.label} title={card.title}>
            <CountTable label={card.label} heading={card.heading} rows={card.rows} />
        </SettingCard>
    );
}
