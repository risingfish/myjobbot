import type { ChartSeries } from "../../../src/web/chartSeries.js";
import type { ModuleRowView } from "../../../src/web/monitoringSources.js";
import { Panel } from "../sections/Panel.js";
import { DataTable } from "../sections/DataTable.js";
import { MonitoringChart } from "./MonitoringChart.js";

const NOTHING = "Nothing in this period";
const HEADINGS = ["Module", "Fetches", "OK", "At the limit", "Failing", "Skipped", "Pages", "Jobs", "Cost", "Top failure reasons", "Sources failing repeatedly"];

/** Gives one module's cells: its fetches by outcome, what they read, and its failures. */
function moduleCells(row: ModuleRowView) {
    return [row.module, row.fetches, row.ok, row.partial, row.failing, row.skipped, row.pages, row.jobs, row.cost, row.reasons, row.failingSources];
}

/** Renders the Sources panel: fetches per day, and each source module's fetches in the period, never naming a source. */
export function SourcesPanel({ rows, chart }: { rows: ModuleRowView[]; chart: ChartSeries }) {
    return (
        <Panel title="Sources">
            {rows.length === 0 ? <p className="note">{NOTHING}</p> : <MonitoringChart label="Fetches per day" series={chart} />}
            {rows.length === 0 ? null : <DataTable label="Source modules" headings={HEADINGS} rows={rows.map((row) => ({ key: row.module, cells: moduleCells(row) }))} />}
        </Panel>
    );
}
