import { useEffect, useId, useRef, type RefObject } from "react";
import type { JobKey } from "../../../src/db/store.js";
import type { JobRowView } from "../../../src/web/api.js";
import { jobParam } from "../../lib/jobParam.js";
import { JobSection } from "./JobSection.js";

interface DetailsPanelProps {
    open: JobKey | null;
    job: JobRowView | null;
    onClose: () => void;
}

type PanelRef = RefObject<HTMLDialogElement | null>;

/** Shows the open job's details in a panel at the right of the page, leaving the list usable behind it. */
export function DetailsPanel({ open, job, onClose }: DetailsPanelProps) {
    const panel = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useShown(panel, open === null ? null : jobParam(open));
    useDismissal(panel, open !== null, onClose);
    return (
        <dialog ref={panel} className="details-panel" aria-labelledby={titleId}>
            {open !== null && <PanelContent job={job} titleId={titleId} onClose={onClose} />}
        </dialog>
    );
}

/** Renders the open panel: the job's title as its heading, a close button, and the job's sections. */
function PanelContent({ job, titleId, onClose }: { job: JobRowView | null; titleId: string; onClose: () => void }) {
    return (
        <>
            <header className="details-head">
                <h2 id={titleId} tabIndex={-1}>
                    {job === null ? "Job not found" : job.title}
                </h2>
                <button type="button" onClick={onClose}>
                    Close
                </button>
            </header>
            <div className="details-body">{job !== null && <JobSection job={job} />}</div>
        </>
    );
}

/** Opens or closes the panel to match the open job's name, moving focus into it on open and back to the job's title on close. */
function useShown(panel: PanelRef, name: string | null): void {
    const shown = useRef<string | null>(null);
    useEffect(() => {
        const dialog = panel.current;
        if (dialog === null) return;
        if (name !== null) {
            if (!dialog.open) dialog.show();
            dialog.querySelector("h2")?.focus({ preventScroll: true });
        } else if (dialog.open) {
            dialog.close();
            returnFocus(shown.current);
        }
        shown.current = name;
    }, [panel, name]);
}

/** Gives focus back to the title of the job the panel showed, or to the page's main area when that title isn't listed. */
function returnFocus(name: string | null): void {
    const title = [...document.querySelectorAll<HTMLElement>("[data-job-link]")].find((link) => link.dataset.jobLink === name);
    (title ?? document.querySelector<HTMLElement>("main"))?.focus({ preventScroll: true });
}

/** Closes the panel on Escape, or on a click outside it that isn't on a job title or a row's own controls. */
function useDismissal(panel: PanelRef, isOpen: boolean, onClose: () => void): void {
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
        const onPointer = (event: PointerEvent) => isOutside(panel.current, event.target) && onClose();
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onPointer);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onPointer);
        };
    }, [panel, isOpen, onClose]);
}

/** Tells whether a click landed outside the panel and away from anything marked to keep it open. */
function isOutside(dialog: HTMLDialogElement | null, target: EventTarget | null): boolean {
    if (!(target instanceof Element) || dialog === null) return false;
    return !dialog.contains(target) && target.closest("[data-keeps-panel]") === null;
}
