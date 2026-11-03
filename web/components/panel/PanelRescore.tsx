import type { JobKey } from "../../../src/db/store.js";
import { useRescore } from "../../lib/useRescore.js";
import type { RescoreControls } from "../../lib/useRescoreTerminal.js";

/** Renders the panel's Re-score button, which reads "Re-scoring…" and waits while the re-score starts and runs, followed by what the re-score said. */
export function PanelRescore({ job, rescore }: { job: JobKey; rescore: RescoreControls }) {
    const { working, press } = useRescore(job, rescore.onStart);
    const busy = working || rescore.running;
    return (
        <span className="panel-rescore">
            <button type="button" className="outline secondary" disabled={busy} onClick={() => void press()}>
                {busy ? "Re-scoring…" : "Re-score"}
            </button>
            {rescore.note !== null && <small className="note">{rescore.note}</small>}
        </span>
    );
}
