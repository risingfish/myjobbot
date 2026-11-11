import type { Period } from "../../../src/monitoring/periods.js";
import type { ChartSeries } from "../../../src/web/chartSeries.js";
import type { RunRowView } from "../../../src/web/monitoringRuns.js";
import { Panel } from "../sections/Panel.js";
import { SettingCard } from "../settings/SettingParts.js";
import { DataTable } from "../sections/DataTable.js";
import { MonitoringChart } from "./MonitoringChart.js";
import { PeriodChoice } from "./PeriodChoice.js";
import { SectionGrid } from "./SectionGrid.js";

const SUMMARY = "Each run of the agent, scheduled or started by hand, with how it went and what it did. A run that shows no sign of life for 5 minutes counts as never finished; open one to see each user's part.";

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

/** Gives the Runs section's cards, runs per day and the runs themselves, or none when there are no runs. */
function runCards(rows: RunRowView[], chart: ChartSeries, period: Period) {
    if (rows.length === 0) return [];
    const chartCard = (
        <SettingCard key="chart" title="Runs per day">
            <MonitoringChart label="Runs per day" series={chart} />
        </SettingCard>
    );
    const tableCard = (
        <SettingCard key="table" title="Runs">
            <DataTable label="Runs" headings={HEADINGS} rows={rows.map((row) => ({ key: row.id, cells: runCells(row, period) }))} />
        </SettingCard>
    );
    return [chartCard, tableCard];
}

/** Renders the Runs panel: the period choice, then runs per day beside each run with its outcome and counts, each in its card, or that there are none. */
export function RunsPanel({ period, rows, chart }: { period: Period; rows: RunRowView[]; chart: ChartSeries }) {
    return (
        <Panel title="Runs">
            <p>{SUMMARY}</p>
            <PeriodChoice period={period} />
            <SectionGrid empty={NO_RUNS} items={runCards(rows, chart, period)} />
        </Panel>
    );
}
