import { useEffect, useId, useRef, type RefObject } from "react";
import type { JobRowView } from "../../../src/web/api.js";
import { useJobDetails } from "../../lib/useJobDetails.js";
import { ScoreModalBody } from "./ScoreModalBody.js";

interface ScoreModalProps {
    job: JobRowView;
    onClose: () => void;
}

/** Shows how a job was scored in a modal over the page, closed by its X, its Close button or Escape. */
export function ScoreModal({ job, onClose }: ScoreModalProps) {
    const dialog = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useModal(dialog, onClose);
    return (
        <dialog ref={dialog} className="score-modal" aria-labelledby={titleId} onClose={onClose} data-keeps-panel>
            <ScoreCard job={job} titleId={titleId} onClose={onClose} />
        </dialog>
    );
}

/** Renders the modal's card: the job's title with the X, the score's rows once loaded, and the Close button. */
function ScoreCard({ job, titleId, onClose }: ScoreModalProps & { titleId: string }) {
    const details = useJobDetails({ ats: job.ats, jobId: job.jobId });
    return (
        <article>
            <header>
                <button type="button" aria-label="Close" rel="prev" onClick={onClose} />
                <h3 id={titleId}>Score for {job.title}</h3>
            </header>
            <ScoreModalBody details={details} />
            <footer>
                <button type="button" className="secondary" onClick={onClose}>
                    Close
                </button>
            </footer>
        </article>
    );
}

/** Opens the dialog as a modal when it mounts and closes it on Escape wherever focus is, catching the key first so it doesn't also close the details panel behind. */
function useModal(dialog: RefObject<HTMLDialogElement | null>, onClose: () => void): void {
    useEffect(() => {
        if (dialog.current?.open === false) dialog.current.showModal();
    }, [dialog]);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            onClose();
        };
        document.addEventListener("keydown", onKey, true);
        return () => document.removeEventListener("keydown", onKey, true);
    }, [onClose]);
}
