import type { JobRowView } from "../../../src/web/api.js";
import { panelApplied, panelHide } from "../../lib/panelActions.js";
import { useApplied } from "../../lib/useApplied.js";
import { useHide } from "../../lib/useHide.js";
import type { Details } from "../../lib/useJobDetails.js";
import { SaveFailedNote } from "../forms/SaveFailedNote.js";

interface PanelHeaderProps {
    job: JobRowView | null;
    details: Details;
    titleId: string;
    onApplied: (job: JobRowView, appliedOn: string | null) => void;
    onHidden: (job: JobRowView) => void;
    onClose: () => void;
}

/** Renders the panel's header: the shown job's title as its heading, then the actions on the job and the close button. */
export function PanelHeader({ job, details, titleId, onApplied, onHidden, onClose }: PanelHeaderProps) {
    const row = job ?? (details.state === "found" ? details.view.job : null);
    return (
        <header className="details-head">
            <h2 id={titleId} tabIndex={-1}>
                {headingText(job, details)}
            </h2>
            <div className="details-actions">
                {row !== null && <PanelApplied job={row} onApplied={(appliedOn) => onApplied(row, appliedOn)} />}
                {row !== null && <PanelHide job={row} onHidden={onHidden} />}
                <button type="button" onClick={onClose}>
                    Close
                </button>
            </div>
        </header>
    );
}

/** Names the shown job for the panel's heading, or says it is loading or doesn't exist. */
function headingText(job: JobRowView | null, details: Details): string {
    if (details.state === "found") return details.view.job.title;
    if (details.state === "missing") return "Job not found";
    return job?.title ?? (details.state === "loading" ? "Loading…" : "Job details");
}

/** Renders the panel's green Applied button, or "Applied ✓", which undoes the mark once confirmed, saying so if the change fails. */
function PanelApplied({ job, onApplied }: { job: JobRowView; onApplied: (appliedOn: string | null) => void }) {
    const { status, submit } = useApplied(job, onApplied);
    const done = panelApplied(job) === "done";
    return (
        <form className="panel-applied" onSubmit={(event) => void submit(event)}>
            <button className={done ? "applied-done" : "applied-action"} disabled={status === "saving"}>
                {done ? "Applied ✓" : "Applied"}
            </button>
            <SaveFailedNote status={status} />
        </form>
    );
}

/** Renders the panel's Hide button, styled like Close and disabled for a job already hidden, saying so if the change fails. */
function PanelHide({ job, onHidden }: { job: JobRowView; onHidden: (job: JobRowView) => void }) {
    const { status, submit } = useHide(job, () => onHidden(job));
    if (panelHide(job) === "disabled") {
        return (
            <button type="button" disabled title="Already hidden" aria-label="Hide (already hidden)">
                Hide
            </button>
        );
    }
    return (
        <form className="panel-hide" onSubmit={(event) => void submit(event)}>
            <button disabled={status === "saving"}>Hide</button>
            <SaveFailedNote status={status} />
        </form>
    );
}
