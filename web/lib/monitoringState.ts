import { periodOf, periodSince, type Period } from "../../src/monitoring/periods.js";
import type { ChartSeries } from "../../src/web/chartSeries.js";
import { runDetailRows, runRows, runsPerDay, type PartRowView, type RunRowView } from "../../src/web/monitoringRuns.js";
import { fetchesPerDay, moduleRows, type ModuleRowView } from "../../src/web/monitoringSources.js";
import { myStores } from "./myStores.js";
import { requireSession } from "./session.js";

type Asked = Record<string, string | string[] | undefined>;

interface MonitoringState {
    period: Period;
    runs: RunRowView[];
    runsChart: ChartSeries;
    detail: { run: RunRowView; parts: PartRowView[] } | null;
    modules: ModuleRowView[];
    fetchesChart: ChartSeries;
}

/** Returns what the Monitoring page shows an admin for the period asked for, and one run's detail when one is asked for, or null for anyone else. */
export async function getMonitoringState(asked: Asked): Promise<MonitoringState | null> {
    const { account } = await requireSession();
    if (!account.isAdmin) return null;
    const { monitoring } = await myStores();
    const now = new Date();
    const period = periodOf(asked.period);
    const since = periodSince(period, now);
    const [runs, fetches] = await Promise.all([monitoring.runs(since), monitoring.fetches(since)]);
    const detail = typeof asked.run === "string" ? await monitoring.run(asked.run) : null;
    return { period, runs: runRows(runs, now), runsChart: runsPerDay(runs, now), detail: detail === null ? null : runDetailRows(detail, now), modules: moduleRows(fetches), fetchesChart: fetchesPerDay(fetches) };
}
