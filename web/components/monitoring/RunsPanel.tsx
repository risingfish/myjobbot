import type { Period } from "../../../src/monitoring/periods.js";
import type { ChartSeries } from "../../../src/web/chartSeries.js";
import type { RunRowView } from "../../../src/web/monitoringRuns.js";
import { Panel } from "../sections/Panel.js";
import { DataTable } from "../sections/DataTable.js";
import { MonitoringChart } from "./MonitoringChart.js";
import { PeriodChoice } from "./PeriodChoice.js";

const NO_RUNS = "No runs yet";
const HEADINGS = ["Started", "Took", "Status", "Users", "Fetches", "Jobs", "Model calls"];

/** Gives one run's cells: its start linking to its detail, how long it took, how it stands, and its counts. */
function runCells(row: RunRowView, period: Period) {
    const status = (
        <>
            {row.status}
            {row.incomplete ? <small className="note"> (record incomplete)</small> : null}
        </>
    );
    return [<a href={`/monitoring?period=${period}&run=${row.id}`}>{row.started}</a>, row.duration, status, row.users, row.fetches, row.jobs, row.modelCalls];
}

/** Renders the Runs panel: the period choice, runs per day, and each run with its outcome and counts, or that there are none. */
export function RunsPanel({ period, rows, chart }: { period: Period; rows: RunRowView[]; chart: ChartSeries }) {
    return (
        <Panel title="Runs">
            <PeriodChoice period={period} />
            {rows.length === 0 ? <p className="note">{NO_RUNS}</p> : <MonitoringChart label="Runs per day" series={chart} />}
            {rows.length === 0 ? null : <DataTable label="Runs" headings={HEADINGS} rows={rows.map((row) => ({ key: row.id, cells: runCells(row, period) }))} />}
        </Panel>
    );
}
