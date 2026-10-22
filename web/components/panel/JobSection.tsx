import type { JobDetailView, JobRowView } from "../../../src/web/api.js";
import { Fact, PanelSection } from "./PanelSection.js";

const REMOTE: Record<JobRowView["remote"], string> = { yes: "Yes", no: "No", "": "" };

type Terms = Pick<JobDetailView["job"], "pay" | "workplace">;

/** Shows the job's own facts in the details panel: company, place, terms once loaded, source, age and whether it is hidden. */
export function JobSection({ job, terms }: { job: JobRowView; terms: Terms | null }) {
    const posted = `${job.posted.date} · ${job.posted.daysOpen} days open${job.posted.ghost ? " · possible ghost" : ""}`;
    return (
        <PanelSection title="Job">
            <dl className="details-facts">
                <Fact label="Company" value={job.company} />
                <Fact label="Location" value={job.location} />
                <Fact label="Works remotely" value={REMOTE[job.remote]} />
                {terms !== null && <Fact label="Workplace" value={terms.workplace ?? ""} />}
                {terms !== null && <Fact label="Pay" value={terms.pay ?? ""} />}
                <Fact label="Source" value={job.via === null ? job.source : `${job.source} via ${job.via}`} />
                <Fact label="Posted" value={posted} />
                <Fact label="Hidden" value={job.hidden ? "Hidden by you" : "Not hidden"} />
            </dl>
        </PanelSection>
    );
}
