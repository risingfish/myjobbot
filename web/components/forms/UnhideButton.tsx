import type { JobRowView } from "../../../src/web/api.js";
import { useHide } from "../../lib/useHide.js";
import { EyeIcon } from "../common/EyeIcon.js";
import { SaveFailedNote } from "./SaveFailedNote.js";

const QUESTION = "Are you sure you want to unhide this job?";

interface UnhideButtonProps {
    job: JobRowView;
    onHidden: (hidden: boolean) => void;
}

/** Renders a hidden job's closed eye as a button that unhides it once the owner confirms, saying so if the change fails. */
export function UnhideButton({ job, onHidden }: UnhideButtonProps) {
    const { status, submit } = useHide(job, onHidden, QUESTION);
    return (
        <form className="applied-form" onSubmit={(event) => void submit(event)}>
            <button className="unhide" disabled={status === "saving"} aria-label="Unhide" title="Hidden by you: unhide">
                <EyeIcon open={false} />
            </button>
            <SaveFailedNote status={status} />
        </form>
    );
}
