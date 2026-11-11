import type { FetchRow } from "../db/monitoringReads.js";
import type { MetricValue } from "./definitions.js";
import { counted, inWindow, WINDOWS, type Snapshot } from "./snapshot.js";

/** Gives each module's longest current run of failing fetches among its sources, from fetches newest first. */
function failingStreaks(fetches: FetchRow[]): MetricValue[] {
    const streaks = new Map<number, { module: string; count: number; broken: boolean }>();
    for (const fetch of fetches) {
        const streak = streaks.get(fetch.sourceId) ?? { module: fetch.module, count: 0, broken: false };
        if (!streak.broken && fetch.outcome === "failing") streak.count += 1;
        else streak.broken = true;
        streaks.set(fetch.sourceId, streak);
    }
    const byModule = new Map<string, number>();
    for (const { module, count } of streaks.values()) byModule.set(module, Math.max(byModule.get(module) ?? 0, count));
    return [...byModule].map(([module, value]) => ({ name: "myjobbot_source_failing_streak_max", labels: { module }, value }));
}

/** Gives one window's fetches by outcome, failures by fixed reason, and jobs found, by module. */
function windowValues(fetches: FetchRow[], window: string): MetricValue[] {
    const jobs = new Map<string, number>();
    for (const fetch of fetches) jobs.set(fetch.module, (jobs.get(fetch.module) ?? 0) + fetch.jobs);
    const failing = fetches.filter((fetch) => fetch.outcome === "failing");
    return [
        ...counted("myjobbot_source_fetches", fetches.map((fetch) => ({ module: fetch.module, outcome: fetch.outcome, window }))),
        ...counted("myjobbot_source_fetch_failures", failing.map((fetch) => ({ module: fetch.module, reason: fetch.reason ?? "other", window }))),
        ...[...jobs].map(([module, value]) => ({ name: "myjobbot_source_jobs", labels: { module, window }, value })),
    ];
}

/** Gives the sources' metrics: each window's fetches, failures and jobs, and each module's failing streak, never naming a source. */
export function sourceValues({ fetches, now }: Snapshot): MetricValue[] {
    return [...failingStreaks(fetches), ...WINDOWS.flatMap(({ window, ms }) => windowValues(inWindow(fetches, (fetch) => fetch.at, now, ms), window))];
}
