import type { CountRow } from "../../../src/web/counts.js";
import { Panel } from "../sections/Panel.js";
import { countCard } from "./CountTable.js";
import { SectionGrid } from "./SectionGrid.js";

const NOTHING = "Nothing in this period";

interface RescoresProps {
    outcomes: CountRow[];
    typical: string;
    longest: string;
    model: string;
}

/** Renders the re-scores' typical and longest durations and model use, then how they ended in its card in the left column. */
export function RescoresPanel({ rescores }: { rescores: RescoresProps }) {
    const ended = countCard({ title: "How re-scores ended", label: "Re-scores", heading: "How it ended", rows: rescores.outcomes });
    return (
        <Panel title="Re-scores">
            {ended === null ? null : (
                <p className="note">
                    Typical {rescores.typical}, longest {rescores.longest}; model use {rescores.model}
                </p>
            )}
            <SectionGrid empty={NOTHING} items={[ended]} />
        </Panel>
    );
}
