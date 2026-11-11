import type { ChartSeries } from "../../../src/web/chartSeries.js";
import type { ModuleRowView } from "../../../src/web/monitoringSources.js";
import { Panel } from "../sections/Panel.js";
import { SettingCard } from "../settings/SettingParts.js";
import { DataTable } from "../sections/DataTable.js";
import { MonitoringChart } from "./MonitoringChart.js";
import { SectionGrid } from "./SectionGrid.js";

const SUMMARY = "How each kind of source fetched in the period, never naming a saved source. A source failing repeatedly is one whose latest 3 fetches all failed.";

const NOTHING = "Nothing in this period";
const HEADINGS = ["Module", "Fetches", "OK", "At the limit", "Failing", "Skipped", "Pages", "Jobs", "Cost", "Top failure reasons", "Sources failing repeatedly"];

/** Gives one module's cells: its fetches by outcome, what they read, and its failures. */
function moduleCells(row: ModuleRowView) {
    return [row.module, row.fetches, row.ok, row.partial, row.failing, row.skipped, row.pages, row.jobs, row.cost, row.reasons, row.failingSources];
}

/** Gives the Sources section's cards, fetches per day and the source modules, or none when nothing was fetched. */
function sourceCards(rows: ModuleRowView[], chart: ChartSeries) {
    if (rows.length === 0) return [];
    const chartCard = (
        <SettingCard key="chart" title="Fetches per day">
            <MonitoringChart label="Fetches per day" series={chart} />
        </SettingCard>
    );
    const tableCard = (
        <SettingCard key="table" title="Source modules">
            <DataTable label="Source modules" headings={HEADINGS} rows={rows.map((row) => ({ key: row.module, cells: moduleCells(row) }))} />
        </SettingCard>
    );
    return [chartCard, tableCard];
}

/** Renders the Sources panel: fetches per day beside each source module's fetches in the period, each in its card, never naming a source. */
export function SourcesPanel({ rows, chart }: { rows: ModuleRowView[]; chart: ChartSeries }) {
    return (
        <Panel title="Sources">
            <p>{SUMMARY}</p>
            <SectionGrid empty={NOTHING} items={sourceCards(rows, chart)} />
        </Panel>
    );
}
