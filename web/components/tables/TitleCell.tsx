import type { JobRowView } from "../../../src/web/api.js";
import { ExternalLink } from "../common/ExternalLink.js";
import { Why } from "./Why.js";

/** Renders a job's title cell: the posting link, any filter or hidden notes, and the reasoning behind its score. */
export function TitleCell({ job }: { job: JobRowView }) {
  return (
    <td>
      <ExternalLink url={job.url}>{job.title}</ExternalLink>
      {job.filterNote && <> <small className="note">{job.filterNote}</small></>}
      {" "}<small className="note hidden-note">hidden by you</small>
      <Why reasons={job.reasons} gaps={job.gaps} />
    </td>
  );
}
