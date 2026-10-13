import type { JobRowView, PageData, PageName } from "../../../api.js";
import { HideButton } from "../forms/HideButton.js";
import { LoadMore } from "../tables/LoadMore.js";
import { JobTable, VerdictTable } from "../tables/Tables.js";
import { usePageRows, type PageRows } from "../../usePageRows.js";

/** Shows one data page: its summary and rows, its empty-state message, or why loading failed. */
export function RowsPage({ name }: { name: PageName }) {
  const rows = usePageRows(name);
  if (rows.error !== null) return <p className="error">{rows.error}</p>;
  if (rows.data === null) return <p><small>Loading…</small></p>;
  const { summary, total, empty } = rows.data;
  return <><p>{summary}</p>{total === 0 ? <p>{empty}</p> : <Rows name={name} data={rows.data} rows={rows} />}</>;
}

/** Renders a page's rows in the table that suits their kind, with Hide buttons and a row that loads more. */
function Rows({ name, data, rows }: { name: PageName; data: PageData; rows: PageRows }) {
  const more = data.nextOffset === null ? undefined : (columns: number) => <LoadMore columns={columns} onLoad={rows.loadMore} error={rows.moreError} />;
  if (data.kind === "verdicts") return <VerdictTable rows={data.rows} more={more} />;
  const hide = (job: JobRowView) => <HideButton job={job} back={`/${name}`} onHidden={(hidden) => rows.markHidden(job, hidden)} />;
  return <JobTable rows={data.rows} action={hide} more={more} />;
}
