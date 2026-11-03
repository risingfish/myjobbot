import { useEffect, useId, useRef, useState, type RefObject } from "react";
import type { JobKey } from "../../../src/db/store.js";
import type { JobDetailView, JobRowView, RescoreMark } from "../../../src/web/api.js";
import { jobParam } from "../../lib/jobParam.js";
import { useJobDetails, type Details } from "../../lib/useJobDetails.js";
import { useRescoreTerminal } from "../../lib/useRescoreTerminal.js";
import { DescriptionSection } from "./DescriptionSection.js";
import { HistorySection } from "./HistorySection.js";
import { JobSection } from "./JobSection.js";
import { PanelHeader } from "./PanelHeader.js";
import { RescoreTerminal } from "./RescoreTerminal.js";
import { ScoreSection } from "./ScoreSection.js";
import { WarningsSection } from "./WarningsSection.js";

interface DetailsPanelProps {
    open: boolean;
    shown: JobKey | null;
    job: JobRowView | null;
    onApplied: (job: JobRowView, appliedOn: string | null) => void;
    onHidden: (job: JobRowView) => void;
    onRescored: (job: JobRowView, row: JobRowView) => void;
    onClose: () => void;
}

interface ContentProps {
    job: JobRowView | null;
    details: Details;
    titleId: string;
    onApplied: (job: JobRowView, appliedOn: string | null) => void;
    onHidden: (job: JobRowView) => void;
    rescore: ReturnType<typeof useRescoreTerminal>;
    onClose: () => void;
}

type PanelRef = RefObject<HTMLDialogElement | null>;
type OpenLog = (mark: RescoreMark) => void;

/** Shows the open job's details in a panel at the right of the page, leaving the list usable behind it, and reloads them after a re-score. */
export function DetailsPanel({ open, shown, job, onApplied, onHidden, onRescored, onClose }: DetailsPanelProps) {
    const panel = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const [refresh, setRefresh] = useState(0);
    const details = useJobDetails(shown, refresh);
    const rescore = useRescoreTerminal(open ? shown : null, { details, bump: () => setRefresh((count) => count + 1), onRescored });
    useShown(panel, open && shown !== null ? jobParam(shown) : null);
    useDismissal(panel, open, onClose);
    return (
        <dialog ref={panel} className="details-panel" aria-labelledby={titleId}>
            {shown !== null && <PanelContent job={job} details={details} titleId={titleId} onApplied={onApplied} onHidden={onHidden} rescore={rescore} onClose={onClose} />}
        </dialog>
    );
}

/** Renders the shown job: its header, with the title and the actions on the job, its re-score terminal while one is open, and the job's sections. */
function PanelContent({ job, details, titleId, onApplied, onHidden, rescore, onClose }: ContentProps) {
    return (
        <>
            <PanelHeader job={job} details={details} titleId={titleId} onApplied={onApplied} onHidden={onHidden} rescore={rescore.controls} onClose={onClose} />
            {rescore.terminal !== null && <RescoreTerminal key={rescore.terminal.run} run={rescore.terminal.run} job={rescore.terminal.key} onEnd={rescore.ended} onClose={rescore.close} />}
            <div className="details-body">
                <PanelStatus details={details} />
                <PanelSections job={job} details={details} onOpenLog={rescore.openLog} />
            </div>
        </>
    );
}

/** Says the details are still loading, or why they couldn't be loaded. */
function PanelStatus({ details }: { details: Details }) {
    if (details.state === "loading") return <p className="details-status">Loading…</p>;
    if (details.state === "failed") return <p className="details-status" role="alert">{`Couldn't load details: ${details.error}`}</p>;
    return null;
}

/** Shows the job's sections from its listed row, adding what only the loaded details hold once they arrive. */
function PanelSections({ job, details, onOpenLog }: { job: JobRowView | null; details: Details; onOpenLog: OpenLog }) {
    const view = details.state === "found" ? details.view : null;
    const facts = job ?? view?.job ?? null;
    if (details.state === "missing" || facts === null) return null;
    return (
        <>
            <JobSection job={facts} terms={view?.job ?? null} />
            {view !== null && <LoadedSections view={view} onOpenLog={onOpenLog} />}
        </>
    );
}

/** Shows the sections only the loaded details can fill, in the panel's order: score, description, warnings and history, whose re-scores open their logs. */
function LoadedSections({ view, onOpenLog }: { view: JobDetailView; onOpenLog: OpenLog }) {
    return (
        <>
            <ScoreSection score={view.score} />
            <DescriptionSection description={view.description} />
            <WarningsSection warnings={view.warnings} />
            <HistorySection history={view.history} onOpenLog={onOpenLog} />
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
