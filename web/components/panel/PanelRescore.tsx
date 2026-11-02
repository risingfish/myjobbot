import type { JobRowView } from "../../../src/web/api.js";
import { useRescore } from "../../lib/useRescore.js";

/** Renders the panel's Re-score button, which reads "Re-scoring…" and waits while it works, followed by what the re-score said. */
export function PanelRescore({ job, onRescored }: { job: JobRowView; onRescored: (row: JobRowView) => void }) {
    const { working, note, press } = useRescore(job, onRescored);
    return (
        <span className="panel-rescore">
            <button type="button" className="outline secondary" disabled={working} onClick={() => void press()}>
                {working ? "Re-scoring…" : "Re-score"}
            </button>
            {note !== null && <small className="note">{note}</small>}
        </span>
    );
}
