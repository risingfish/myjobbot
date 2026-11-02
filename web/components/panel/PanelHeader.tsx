import type { JobRowView } from "../../../src/web/api.js";
import { panelApplied, panelHide } from "../../lib/panelActions.js";
import { useApplied } from "../../lib/useApplied.js";
import { useHide } from "../../lib/useHide.js";
import type { Details } from "../../lib/useJobDetails.js";
import { PostingLink } from "../common/PostingLink.js";
import { SaveFailedNote } from "../forms/SaveFailedNote.js";
import { PanelRescore } from "./PanelRescore.js";

interface PanelHeaderProps {
    job: JobRowView | null;
    details: Details;
    titleId: string;
    onApplied: (job: JobRowView, appliedOn: string | null) => void;
    onHidden: (job: JobRowView) => void;
    onRescored: (job: JobRowView, row: JobRowView) => void;
    onClose: () => void;
}

type ActionsProps = Pick<PanelHeaderProps, "onApplied" | "onHidden" | "onRescored" | "onClose"> & { row: JobRowView | null };

/** Renders the panel's header: the shown job's title as its heading with the link to its posting, then the actions on the job and the close button. */
export function PanelHeader({ job, details, titleId, ...actions }: PanelHeaderProps) {
    const row = job ?? (details.state === "found" ? details.view.job : null);
    return (
        <header className="details-head">
            <div className="details-title">
                <h2 id={titleId} tabIndex={-1}>
                    {headingText(job, details)}
                </h2>
                {row !== null && <PostingLink url={row.url} />}
            </div>
            <PanelActions row={row} {...actions} />
        </header>
    );
}

/** Renders the actions on the shown job, Re-score, Applied and Hide, once it is known, then the close button. */
function PanelActions({ row, onApplied, onHidden, onRescored, onClose }: ActionsProps) {
    return (
        <div className="details-actions">
            {row !== null && <PanelRescore job={row} onRescored={(updated) => onRescored(row, updated)} />}
            {row !== null && <PanelApplied job={row} onApplied={(appliedOn) => onApplied(row, appliedOn)} />}
            {row !== null && <PanelHide job={row} onHidden={onHidden} />}
            <button type="button" className="outline secondary" onClick={onClose}>
                Close
            </button>
        </div>
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
            <button className={done ? "outline applied-done" : "applied-action"} disabled={status === "saving"}>
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
            <button type="button" className="outline secondary" disabled title="Already hidden" aria-label="Hide (already hidden)">
                Hide
            </button>
        );
    }
    return (
        <form className="panel-hide" onSubmit={(event) => void submit(event)}>
            <button className="outline secondary" disabled={status === "saving"}>
                Hide
            </button>
            <SaveFailedNote status={status} />
        </form>
    );
}
