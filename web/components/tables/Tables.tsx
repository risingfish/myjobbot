import type { ReactNode } from "react";
import type { JobRowView, VerdictRowView } from "../../../src/web/api.js";
import { DataTable } from "./DataTable.js";
import { JobRow } from "./JobRow.js";
import { jobKey } from "../../lib/pageRows.js";
import { VerdictRow } from "./VerdictRow.js";

const JOB_HEADERS = ["Applied", "Score", "Title", "Company", "Location", "Remote", "Source", "Posted", ""];
const VERDICT_HEADERS = ["Scored at", "Run", "Job", "Score", "Reasons", "Gaps"];

type MoreRow = (columns: number) => ReactNode;

interface JobTableProps {
    rows: JobRowView[];
    action: (job: JobRowView) => ReactNode;
    onApplied: (job: JobRowView, appliedOn: string | null) => void;
    onHidden: (job: JobRowView, hidden: boolean) => void;
    more?: MoreRow;
}

/** Renders a table of jobs, one row per job, each with its applied button or unhide eye and the action the page offers. */
export function JobTable({ rows, action, onApplied, onHidden, more }: JobTableProps) {
    return (
        <DataTable headers={JOB_HEADERS} more={more}>
            {rows.map((job) => (
                <JobRow key={jobKey(job)} job={job} onApplied={(appliedOn) => onApplied(job, appliedOn)} onHidden={(hidden) => onHidden(job, hidden)}>
                    {action(job)}
                </JobRow>
            ))}
        </DataTable>
    );
}

/** Renders the table of scoring decisions, one row per verdict. */
export function VerdictTable({ rows, more }: { rows: VerdictRowView[]; more?: MoreRow }) {
    return (
        <DataTable headers={VERDICT_HEADERS} more={more}>
            {rows.map((verdict) => (
                <VerdictRow key={verdict.key} verdict={verdict} />
            ))}
        </DataTable>
    );
}
