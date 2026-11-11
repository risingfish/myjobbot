import type { JobRowView } from "../../../src/web/api.js";
import { useHide } from "../../lib/useHide.js";
import { SaveFailedNote } from "./SaveFailedNote.js";

interface HideButtonProps {
    job: JobRowView;
    onHidden: (hidden: boolean) => void;
}

/** Draws an eye: closed for hiding a job, open for bringing a hidden one back. */
function EyeIcon({ open }: { open: boolean }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {open ? (
                <>
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                </>
            ) : (
                <path d="M2 10c3 4.5 6.5 6.5 10 6.5S19 14.5 22 10M4.5 13.5 3 16M9 16l-.7 3M15 16l.7 3M19.5 13.5 21 16" />
            )}
        </svg>
    );
}

/** Renders the eye button that hides a job, or brings a hidden one back, named for what it does and saying so if the change fails. */
export function HideButton({ job, onHidden }: HideButtonProps) {
    const { status, submit } = useHide(job, onHidden);
    const label = job.hidden ? "Unhide" : "Hide";
    return (
        <form className="hide" onSubmit={(event) => void submit(event)}>
            <button className="outline secondary" disabled={status === "saving"} aria-label={label} title={label}>
                <EyeIcon open={job.hidden} />
            </button>
            <SaveFailedNote status={status} />
        </form>
    );
}
