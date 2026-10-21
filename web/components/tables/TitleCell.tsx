import type { MouseEvent } from "react";
import type { JobRowView } from "../../../src/web/api.js";
import { jobParam, withJob } from "../../lib/jobParam.js";
import { useOpenJob } from "../../lib/useOpenJob.js";
import { Why } from "./Why.js";

/** Renders a job's title cell: the title that opens its details panel, its notes, and the reasoning behind its score. */
export function TitleCell({ job }: { job: JobRowView }) {
    const { search, open } = useOpenJob();
    const key = { ats: job.ats, jobId: job.jobId };
    return (
        <td className="title-cell">
            <a href={withJob(search, key)} title={job.shortTitle === job.title ? undefined : job.title} data-keeps-panel data-job-link={jobParam(key)} onClick={(event) => onPlainClick(event, () => open(key))}>
                {job.shortTitle}
            </a>
            <TitleNotes job={job} />
            <Why reasons={job.reasons} gaps={job.gaps} />
        </td>
    );
}

/** Renders the notes beside a job's title: why a filter hid it, that its text tried to escape the data markers, and that the owner hid it. */
function TitleNotes({ job }: { job: JobRowView }) {
    return (
        <>
            {job.filterNote && (
                <>
                    {" "}
                    <small className="note">{job.filterNote}</small>
                </>
            )}
            {job.injection && (
                <>
                    {" "}
                    <small className="note injection">⚠ tried to escape the data markers</small>
                </>
            )}{" "}
            <small className="note hidden-note">hidden by you</small>
        </>
    );
}

/** Runs the action for a plain left click, leaving modified clicks (new tab, new window) to the browser. */
function onPlainClick(event: MouseEvent, action: () => void): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    action();
}
