"use client";

import type { JobRowView, PageData, PageName } from "../../../src/web/api.js";
import { usePageRows, type PageRows } from "../../lib/usePageRows.js";
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
                <p className="note">Loading more rows and Hide need JavaScript.</p>
            </noscript>
            {data.total === 0 ? <p>{data.empty}</p> : <Rows data={data} rows={rows} />}
        </>
    );
}

/** Renders a page's rows in the table that suits their kind, with Hide buttons and a row that loads more. */
function Rows({ data, rows }: { data: PageData; rows: PageRows }) {
    const more = data.nextOffset === null ? undefined : (columns: number) => <LoadMore columns={columns} onLoad={rows.loadMore} error={rows.moreError} />;
    if (data.kind === "verdicts") return <VerdictTable rows={data.rows} more={more} />;
    const hide = (job: JobRowView) => <HideButton job={job} onHidden={(hidden) => rows.markHidden(job, hidden)} />;
    return <JobTable rows={data.rows} action={hide} more={more} />;
}
