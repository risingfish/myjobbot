import type { ReactNode } from "react";
import type { JobRowView } from "../../../src/web/api.js";
import { SourceCell, WhenCell, WhereCells } from "./JobCells.js";
import { ScoreTipCell } from "./ScoreTipCell.js";
import { TitleCell } from "./TitleCell.js";

/** Renders one job as a table row, with whatever action the page offers in its last cell. */
export function JobRow({ job, children }: { job: JobRowView; children?: ReactNode }) {
    return (
        <tr className="job" data-hidden={Number(job.hidden)}>
            <ScoreTipCell score={job.score} />
            <TitleCell job={job} />
            <WhereCells job={job} />
            <SourceCell job={job} />
            <WhenCell job={job} />
            <td>{children}</td>
        </tr>
    );
}
