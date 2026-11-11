"use client";

import type { JobRowView, PageData, PageName } from "../../../src/web/api.js";
import { offersHide } from "../../lib/pageRows.js";
import { usePageRows, type PageRows } from "../../lib/usePageRows.js";
import type { ReactNode } from "react";
import { useJobChanges } from "../../lib/useJobChanges.js";
import { useOpenJob, usePanelJob } from "../../lib/useOpenJob.js";
import { PostingLink } from "../common/PostingLink.js";
import { DetailsPanel } from "../panel/DetailsPanel.js";
import { HideButton } from "../forms/HideButton.js";
import { LoadMore } from "../tables/LoadMore.js";
import { JobTable, VerdictTable } from "../tables/Tables.js";

/** Shows one data page's summary and rows, starting from the server's first page and loading more in the browser. */
export function RowsList({ name, initial }: { name: PageName; initial: PageData }) {
    const rows = usePageRows(name, initial);
    const data = rows.data ?? initial;
    return (
        <>
            <p>{data.summary}</p>
            <noscript>
                <p className="note">Loading more rows, Hide and Applied need JavaScript.</p>
            </noscript>
            {data.total === 0 ? <p>{data.empty}</p> : <Rows data={data} rows={rows} name={name} />}
        </>
    );
}

/** Renders a page's rows in the table that suits their kind, with a row that loads more; All jobs lists every job, so it offers no Hide. */
function Rows({ data, rows, name }: { data: PageData; rows: PageRows; name: PageName }) {
    const more = data.nextOffset === null ? undefined : (columns: number) => <LoadMore columns={columns} onLoad={rows.loadMore} error={rows.moreError} />;
    if (data.kind === "verdicts") return <VerdictTable rows={data.rows} more={more} />;
    return <JobRows jobs={data.rows} rows={rows} more={more} hideable={offersHide(name)} />;
}

/** Renders the job table, each row with its applied button, posting link and, where the page offers it, the Hide button, and the details panel for the job the address names, passing saved changes to both. */
function JobRows({ jobs, rows, more, hideable }: { jobs: JobRowView[]; rows: PageRows; more?: (columns: number) => ReactNode; hideable: boolean }) {
    const { key, close } = useOpenJob();
    const panel = usePanelJob(jobs, key);
    const changes = useJobChanges(rows, panel, close);
    const actions = (job: JobRowView) => (
        <span className="row-actions" data-keeps-panel>
            <PostingLink url={job.url} />
            {hideable ? <HideButton job={job} onHidden={(hidden) => changes.markHidden(job, hidden)} /> : null}
        </span>
    );
    return (
        <>
            <JobTable rows={jobs} action={actions} onApplied={changes.markApplied} more={more} />
            <DetailsPanel open={key !== null} shown={panel.shown} job={panel.job} onApplied={changes.markApplied} onHidden={changes.hideFromPanel} onRescored={changes.markRescored} onClose={close} />
        </>
    );
}
