import type { RunRow } from "../db/monitoringReads.js";
import { runStatus } from "../monitoring/runStatus.js";
import type { MetricValue } from "./definitions.js";
import { counted, inWindow, WINDOWS, type Snapshot } from "./snapshot.js";
import { sourceValues } from "./sourceValues.js";
import { workValues } from "./workValues.js";

const SECONDS = 1000;

/** Gives the latest run's times and whether the latest that ended finished cleanly; with none recorded its finish is 0, so a missed run still shows. */
function lastRunValues(runs: RunRow[]): MetricValue[] {
    const ended = runs.find((run) => run.endedAt !== null);
    const at = (iso: string | null | undefined) => (iso === null || iso === undefined ? 0 : Date.parse(iso) / SECONDS);
    return [
        { name: "myjobbot_last_run_started_timestamp_seconds", labels: {}, value: at(runs[0]?.startedAt) },
        { name: "myjobbot_last_run_finished_timestamp_seconds", labels: {}, value: at(ended?.endedAt) },
        { name: "myjobbot_last_run_ok", labels: {}, value: ended === undefined || ended.outcome === "finished" ? 1 : 0 },
    ];
}

/** Gives the runs alive now, and over each window the runs by how they stand and the longest that ended. */
function runValues(runs: RunRow[], now: Date): MetricValue[] {
    const values = [...lastRunValues(runs), { name: "myjobbot_runs_running", labels: {}, value: runs.filter((run) => runStatus(run, now) === "running").length }];
    for (const { window, ms } of WINDOWS) {
        const shown = inWindow(runs, (run) => run.startedAt, now, ms);
        const durations = shown.flatMap((run) => (run.endedAt === null ? [] : [(Date.parse(run.endedAt) - Date.parse(run.startedAt)) / SECONDS]));
        values.push(...counted("myjobbot_runs", shown.map((run) => ({ status: runStatus(run, now), window }))), { name: "myjobbot_run_duration_seconds_max", labels: { window }, value: Math.max(0, ...durations) });
    }
    return values;
}

/** Gives every metric's values for one scrape, from what the stored history holds now. */
export function metricValues(snapshot: Snapshot): MetricValue[] {
    return [...runValues(snapshot.runs, snapshot.now), ...sourceValues(snapshot), ...workValues(snapshot)];
}
