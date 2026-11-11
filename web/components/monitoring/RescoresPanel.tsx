import type { CountRow } from "../../../src/web/counts.js";
import { Panel } from "../sections/Panel.js";
import { CountTable } from "./CountTable.js";

const NOTHING = "Nothing in this period";

interface RescoresProps {
    outcomes: CountRow[];
    typical: string;
    longest: string;
    model: string;
}

/** Renders the re-scores' typical and longest durations and model use beside how they ended. */
export function RescoresPanel({ rescores }: { rescores: RescoresProps }) {
    if (rescores.outcomes.length === 0)
        return (
            <Panel title="Re-scores">
                <p className="note">{NOTHING}</p>
            </Panel>
        );
    return (
        <Panel title="Re-scores">
            <div className="grid">
                <p className="note">
                    Typical {rescores.typical}, longest {rescores.longest}; model use {rescores.model}
                </p>
                <CountTable label="Re-scores" heading="How it ended" rows={rescores.outcomes} />
            </div>
        </Panel>
    );
}
