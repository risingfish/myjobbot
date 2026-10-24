import type { JobRowView } from "../../../src/web/api.js";
import { rowLabel, useLocalTimeZone } from "../../lib/appliedTime.js";
import { useApplied } from "../../lib/useApplied.js";
import { AppliedMark } from "../tables/AppliedMark.js";
import { SaveFailedNote } from "./SaveFailedNote.js";

interface AppliedButtonProps {
    job: JobRowView;
    onApplied: (appliedOn: string | null) => void;
}

/** Renders a row's applied mark as a button that marks the job, or undoes the mark once confirmed, saying so if the change fails. */
export function AppliedButton({ job, onApplied }: AppliedButtonProps) {
    const { status, submit } = useApplied(job, onApplied);
    const label = rowLabel(job, useLocalTimeZone());
    return (
        <form className="applied-form" onSubmit={(event) => void submit(event)}>
            <button disabled={status === "saving"} aria-label={label} title={label}>
                <AppliedMark applied={job.applied} />
            </button>
            <SaveFailedNote status={status} />
        </form>
    );
}
