import type { PartRowView, RunRowView } from "../../../src/web/monitoringRuns.js";
import { Panel } from "../sections/Panel.js";
import { SettingCard } from "../settings/SettingParts.js";
import { DataTable } from "../sections/DataTable.js";

const SUMMARY = "Each user's part of this run, by user id, with how it ended and what it did.";

const HEADINGS = ["User", "Outcome", "Reason", "Fetches", "Jobs", "Lookups", "Searches", "Model"];

/** Renders one run's detail: how it stands, and each user's part of it, by user id. */
export function RunDetail({ run, parts }: { run: RunRowView; parts: PartRowView[] }) {
    const rows = parts.map((part) => ({ key: part.user, cells: [part.user, part.outcome, part.reason ?? "", part.fetches, part.jobs, part.lookups, part.searches, part.model] }));
    return (
        <Panel title={`Run started ${run.started}`}>
            <p>{SUMMARY}</p>
            <p className="note">
                {run.status}, took {run.duration}
                {run.incomplete ? " (record incomplete)" : ""}
            </p>
            <SettingCard title="Parts of the run">
                <DataTable label="Parts of the run" headings={HEADINGS} rows={rows} />
            </SettingCard>
        </Panel>
    );
}
