import type { FetchRow } from "../db/monitoringReads.js";
import { failingRepeatedly } from "../monitoring/failing.js";
import { moduleFor } from "../sources/registry.js";
import { localTime } from "./localTime.js";
import { perDay, type ChartSeries } from "./chartSeries.js";

export interface ModuleRowView {
    module: string;
    fetches: number;
    ok: number;
    partial: number;
    failing: number;
    skipped: number;
    pages: number;
    jobs: number;
    cost: number;
    reasons: string;
    failingSources: number;
}

const TOP_REASONS = 3;

/** Names the most common failure reasons among a module's fetches, with how often each came up. */
function topReasons(fetches: FetchRow[]): string {
    const counts = new Map<string, number>();
    for (const fetch of fetches) if (fetch.outcome === "failing") counts.set(fetch.reason ?? "unexpected answer", (counts.get(fetch.reason ?? "unexpected answer") ?? 0) + 1);
    const ranked = [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    return ranked
        .slice(0, TOP_REASONS)
        .map(([reason, count]) => `${reason} (${count})`)
        .join(", ");
}

/** Counts a module's sources whose latest 3 fetches, newest first as read, all failed. */
function sourcesFailing(fetches: FetchRow[]): number {
    const bySource = new Map<number, string[]>();
    for (const fetch of fetches) bySource.set(fetch.sourceId, [...(bySource.get(fetch.sourceId) ?? []), fetch.outcome]);
    return [...bySource.values()].filter(failingRepeatedly).length;
}

/** Shows one module's fetches in the period as the Monitoring page lists them. */
function moduleRow(module: string, fetches: FetchRow[]): ModuleRowView {
    const count = (outcome: string) => fetches.filter((fetch) => fetch.outcome === outcome).length;
    const sum = (field: "pages" | "jobs" | "cost") => fetches.reduce((total, fetch) => total + fetch[field], 0);
    return { module: moduleFor(module)?.name ?? module, fetches: fetches.length, ok: count("ok"), partial: count("partial"), failing: count("failing"), skipped: count("skipped"), pages: sum("pages"), jobs: sum("jobs"), cost: sum("cost"), reasons: topReasons(fetches), failingSources: sourcesFailing(fetches) };
}

/** Lists each source module's fetches in the period, by module name, never naming a source. */
export function moduleRows(fetches: FetchRow[]): ModuleRowView[] {
    const modules = [...new Set(fetches.map((fetch) => fetch.module))].sort();
    return modules.map((module) => moduleRow(module, fetches.filter((fetch) => fetch.module === module)));
}

/** Counts the fetches made each day by how they went. */
export function fetchesPerDay(fetches: FetchRow[]): ChartSeries {
    return perDay([...fetches].reverse(), (fetch) => (localTime(fetch.at) ?? "").slice(0, 10), (fetch) => fetch.outcome);
}
