import { useState } from "react";
import type { JobRowView } from "../../../src/web/api.js";
import { MagnifierIcon } from "./MagnifierIcon.js";
import { ScoreModal } from "./ScoreModal.js";

/** Renders the magnifier beside a job's score that opens the modal explaining it. */
export function ScoreDetailsButton({ job }: { job: JobRowView }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" className="score-details" aria-label="Score details" title="Score details" onClick={() => setOpen(true)}>
                <MagnifierIcon />
            </button>
            {open && <ScoreModal job={job} onClose={() => setOpen(false)} />}
        </>
    );
}
