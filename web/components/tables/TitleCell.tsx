import type { JobRowView } from "../../../src/web/api.js";
import { ExternalLink } from "../common/ExternalLink.js";
import { Why } from "./Why.js";

/** Renders a job's title cell: the posting link, its notes, and the reasoning behind its score. */
export function TitleCell({ job }: { job: JobRowView }) {
    return (
        <td className="title-cell">
            <ExternalLink url={job.url} title={job.shortTitle === job.title ? undefined : job.title}>
                {job.shortTitle}
            </ExternalLink>
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
