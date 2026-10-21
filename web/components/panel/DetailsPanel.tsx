import { useEffect, useId, useRef, type RefObject } from "react";
import type { JobKey } from "../../../src/db/store.js";
import type { JobRowView } from "../../../src/web/api.js";
import { jobParam } from "../../lib/jobParam.js";
import { useJobDetails, type Details } from "../../lib/useJobDetails.js";
import { JobSection } from "./JobSection.js";

interface DetailsPanelProps {
    open: boolean;
    shown: JobKey | null;
    job: JobRowView | null;
    onClose: () => void;
}

interface ContentProps {
    job: JobRowView | null;
    details: Details;
    titleId: string;
    onClose: () => void;
}

type PanelRef = RefObject<HTMLDialogElement | null>;

/** Shows the open job's details in a panel at the right of the page, leaving the list usable behind it. */
export function DetailsPanel({ open, shown, job, onClose }: DetailsPanelProps) {
    const panel = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const details = useJobDetails(shown);
    useShown(panel, open && shown !== null ? jobParam(shown) : null);
    useDismissal(panel, open, onClose);
    return (
        <dialog ref={panel} className="details-panel" aria-labelledby={titleId}>
            {shown !== null && <PanelContent job={job} details={details} titleId={titleId} onClose={onClose} />}
        </dialog>
    );
}

/** Renders the shown job: its title as the panel's heading, a close button, and the job's sections. */
function PanelContent({ job, details, titleId, onClose }: ContentProps) {
    return (
        <>
            <header className="details-head">
                <h2 id={titleId} tabIndex={-1}>
                    {headingText(job, details)}
                </h2>
                <button type="button" onClick={onClose}>
                    Close
                </button>
            </header>
            <div className="details-body">
                <PanelStatus details={details} />
                <PanelSections job={job} details={details} />
            </div>
        </>
    );
}

/** Names the shown job for the panel's heading, or says it is loading or doesn't exist. */
function headingText(job: JobRowView | null, details: Details): string {
    if (details.state === "found") return details.view.job.title;
    if (details.state === "missing") return "Job not found";
    return job?.title ?? (details.state === "loading" ? "Loading…" : "Job details");
}

/** Says the details are still loading, or why they couldn't be loaded. */
function PanelStatus({ details }: { details: Details }) {
    if (details.state === "loading") return <p className="details-status">Loading…</p>;
    if (details.state === "failed") return <p className="details-status" role="alert">{`Couldn't load details: ${details.error}`}</p>;
    return null;
}

/** Shows the job's sections from its listed row, adding what only the loaded details hold once they arrive. */
function PanelSections({ job, details }: { job: JobRowView | null; details: Details }) {
    const loaded = details.state === "found" ? details.view.job : null;
    const facts = job ?? loaded;
    if (details.state === "missing" || facts === null) return null;
    return <JobSection job={facts} terms={loaded} />;
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
