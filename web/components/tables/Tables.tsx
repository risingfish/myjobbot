import type { ReactNode } from "react";
import type { JobRowView, VerdictRowView } from "../../../src/web/api.js";
import { DataTable } from "./DataTable.js";
import { JobRow } from "./JobRow.js";
import { jobKey } from "../../lib/pageRows.js";
import { VerdictRow } from "./VerdictRow.js";

const JOB_HEADERS = ["Score", "Title", "Company", "Location", "Remote", "Source", "Posted", "Scored", ""];
const VERDICT_HEADERS = ["Scored at", "Run", "Job", "Company", "Score", "Reasons", "Gaps"];

type MoreRow = (columns: number) => ReactNode;

interface JobTableProps {
    rows: JobRowView[];
    action: (job: JobRowView) => ReactNode;
    more?: MoreRow;
}

/** Renders a table of jobs, one row per job, each with the action the page offers. */
export function JobTable({ rows, action, more }: JobTableProps) {
    return (
        <DataTable headers={JOB_HEADERS} more={more}>
            {rows.map((job) => (
                <JobRow key={jobKey(job)} job={job}>
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
