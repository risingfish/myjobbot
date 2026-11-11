import type { Metadata } from "next";
import { notFound } from "next/navigation.js";
import { RunDetail } from "../../../components/monitoring/RunDetail.js";
import { RunsPanel } from "../../../components/monitoring/RunsPanel.js";
import { SourcesPanel } from "../../../components/monitoring/SourcesPanel.js";
import { getMonitoringState } from "../../../lib/monitoringState.js";

export const metadata: Metadata = { title: "Monitoring" };
export const dynamic = "force-dynamic";

/** Renders the Monitoring page for an admin: one run's detail when asked for, the runs in the period and the source modules' fetches; anyone else gets the not-found page. */
export default async function MonitoringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const state = await getMonitoringState(await searchParams);
    if (state === null) notFound();
    return (
        <main className="container-fluid" aria-label="Monitoring">
            {state.detail === null ? null : <RunDetail run={state.detail.run} parts={state.detail.parts} />}
            <RunsPanel period={state.period} rows={state.runs} chart={state.runsChart} />
            <SourcesPanel rows={state.modules} chart={state.fetchesChart} />
        </main>
    );
}
