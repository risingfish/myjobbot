import type { JobRowView } from "../../../src/web/api.js";

/** Renders the cells saying where a job is: its company, location and whether it is remote. */
export function WhereCells({ job }: { job: JobRowView }) {
    return (
        <>
            <td>{job.company}</td>
            <td>{job.location}</td>
            <td>{job.remote}</td>
        </>
    );
}

/** Renders the cell naming where a job came from, with the publisher underneath when known. */
export function SourceCell({ job }: { job: JobRowView }) {
    return (
        <td>
            {job.source}
            {job.via && (
                <>
                    <br />
                    <small>via {job.via}</small>
                </>
            )}
        </td>
    );
}

/** Renders the cell saying when a job was posted and how long it has been open. */
export function WhenCell({ job }: { job: JobRowView }) {
    const { date, daysOpen, ghost } = job.posted;
    return (
        <td>
            {date}
            <br />
            <small>{daysOpen} days open</small>
            {ghost && (
                <>
                    {" "}
                    <span className="ghost">⚠ possible ghost</span>
                </>
            )}
        </td>
    );
}
