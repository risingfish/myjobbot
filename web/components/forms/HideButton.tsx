import type { JobRowView } from "../../../src/web/api.js";
import { useHide } from "../../lib/useHide.js";
import { EyeIcon } from "../common/EyeIcon.js";
import { SaveFailedNote } from "./SaveFailedNote.js";

interface HideButtonProps {
    job: JobRowView;
    onHidden: (hidden: boolean) => void;
}

/** Renders the eye button that hides a job, or brings a hidden one back, named for what it does and saying so if the change fails. */
export function HideButton({ job, onHidden }: HideButtonProps) {
    const { status, submit } = useHide(job, onHidden);
    const label = job.hidden ? "Unhide" : "Hide";
    return (
        <form className="hide" onSubmit={(event) => void submit(event)}>
            <button className="outline secondary" disabled={status === "saving"} aria-label={label} title={label}>
                <EyeIcon open={!job.hidden} />
            </button>
            <SaveFailedNote status={status} />
        </form>
    );
}
