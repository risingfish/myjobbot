import type { CountRow } from "../../../src/web/counts.js";
import { Panel } from "../sections/Panel.js";
import { CountTable } from "./CountTable.js";

const NOTHING = "Nothing in this period";

interface LookupsProps {
    lookups: { outcomes: CountRow[]; pages: CountRow[] };
    searches: { searched: number; failed: number };
}

/** Renders the careers lookups by how they ended and how their pages were read, and the company searches the runs made. */
export function LookupsPanel({ lookups, searches }: LookupsProps) {
    return (
        <Panel title="Careers lookups and company searches">
            <p className="note">
                Company searches: {searches.searched}
                {searches.failed === 0 ? "" : ` (${searches.failed} search steps failed)`}
            </p>
            {lookups.outcomes.length === 0 ? <p className="note">{NOTHING}</p> : <CountTable label="Lookups" heading="How it ended" rows={lookups.outcomes} />}
            {lookups.pages.length === 0 ? null : <CountTable label="Page reads" heading="Read by" rows={lookups.pages} />}
        </Panel>
    );
}
