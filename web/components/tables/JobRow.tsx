import type { ReactNode } from "react";
import type { JobRowView } from "../../../src/web/api.js";
import { AppliedButton } from "../forms/AppliedButton.js";
import { SourceCell, WhenCell, WhereCells } from "./JobCells.js";
import { ScoreTipCell } from "./ScoreTipCell.js";
import { TitleCell } from "./TitleCell.js";

interface JobRowProps {
    job: JobRowView;
    onApplied: (appliedOn: string | null) => void;
    children?: ReactNode;
}

/** Renders one job as a table row: its applied button in the first cell and whatever action the page offers in the last. */
export function JobRow({ job, onApplied, children }: JobRowProps) {
    return (
        <tr className="job" data-hidden={Number(job.hidden)}>
            <td className="applied-cell" data-keeps-panel>
                <AppliedButton job={job} onApplied={onApplied} />
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
