import type { CountRow } from "../../../src/web/counts.js";
import { Panel } from "../sections/Panel.js";
import { countCard } from "./CountTable.js";
import { SectionGrid } from "./SectionGrid.js";

const SUMMARY = "Lookups find missing job descriptions on employers' careers pages; company searches find their websites and careers pages.";

const NOTHING = "Nothing in this period";

interface LookupsProps {
    lookups: { outcomes: CountRow[]; pages: CountRow[] };
    searches: { searched: number; failed: number };
}

/** Renders the company searches the runs made, then the careers lookups by how they ended and how their pages were read, each in its card, filling the columns from the left. */
export function LookupsPanel({ lookups, searches }: LookupsProps) {
    const cards = [countCard({ title: "How lookups ended", label: "Lookups", heading: "How it ended", rows: lookups.outcomes }), countCard({ title: "How pages were read", label: "Page reads", heading: "Read by", rows: lookups.pages })];
    return (
        <Panel title="Careers lookups and company searches">
            <p>{SUMMARY}</p>
            <p className="note">
                Company searches: {searches.searched}
                {searches.failed === 0 ? "" : ` (${searches.failed} search steps failed)`}
            </p>
            <SectionGrid empty={NOTHING} items={cards} />
        </Panel>
    );
}
