import type { ReactNode } from "react";
import type { JobRowView } from "../../../src/web/api.js";
import { AppliedButton } from "../forms/AppliedButton.js";
import { UnhideButton } from "../forms/UnhideButton.js";
import { SourceCell, WhenCell, WhereCells } from "./JobCells.js";
import { ScoreTipCell } from "./ScoreTipCell.js";
import { TitleCell } from "./TitleCell.js";

interface JobRowProps {
    job: JobRowView;
    onApplied: (appliedOn: string | null) => void;
    onHidden: (hidden: boolean) => void;
    children?: ReactNode;
}

/** Renders one job as a table row: its applied button in the first cell, or the closed eye that unhides a hidden job not applied to, and whatever action the page offers in the last. */
export function JobRow({ job, onApplied, onHidden, children }: JobRowProps) {
    return (
        <tr className="job" data-hidden={Number(job.hidden)}>
            <td className="applied-cell" data-keeps-panel>
                {job.hidden && !job.applied ? <UnhideButton job={job} onHidden={onHidden} /> : <AppliedButton job={job} onApplied={onApplied} />}
            </td>
            <ScoreTipCell score={job.score} />
            <TitleCell job={job} />
            <WhereCells job={job} />
            <SourceCell job={job} />
            <WhenCell job={job} />
            <td>{children}</td>
        </tr>
    );
}
