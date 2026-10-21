import type { JobRowView } from "../../../src/web/api.js";
import { PanelSection } from "./PanelSection.js";

const REMOTE: Record<JobRowView["remote"], string> = { yes: "Yes", no: "No", "": "" };

/** Shows the job's own facts in the details panel: company, place, source, age and whether it is hidden. */
export function JobSection({ job }: { job: JobRowView }) {
    const posted = `${job.posted.date} · ${job.posted.daysOpen} days open${job.posted.ghost ? " · possible ghost" : ""}`;
    return (
        <PanelSection title="Job">
            <dl className="details-facts">
                <Fact label="Company" value={job.company} />
                <Fact label="Location" value={job.location} />
                <Fact label="Works remotely" value={REMOTE[job.remote]} />
                <Fact label="Source" value={job.via === null ? job.source : `${job.source} via ${job.via}`} />
                <Fact label="Posted" value={posted} />
                <Fact label="Hidden" value={job.hidden ? "Hidden by you" : "Not hidden"} />
            </dl>
        </PanelSection>
    );
}

/** Shows one labelled fact, saying "unknown" when it is missing. */
function Fact({ label, value }: { label: string; value: string }) {
    return (
        <>
            <dt>{label}</dt>
            <dd>{value === "" ? "unknown" : value}</dd>
        </>
    );
}
