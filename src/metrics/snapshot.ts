import type { FetchRow, LookupRow, MailRow, RescoreRow, RunRow } from "../db/monitoringReads.js";
import type { MetricValue } from "./definitions.js";

export interface Snapshot {
    now: Date;
    runs: RunRow[];
    fetches: FetchRow[];
    lookups: LookupRow[];
    rescores: RescoreRow[];
    mails: MailRow[];
    jsearchUsed: number;
    jsearchCap: number;
}

export const WINDOWS = [
    { window: "24h", ms: 86_400_000 },
    { window: "7d", ms: 7 * 86_400_000 },
];

/** Counts items by their labels, as one value each. */
export function counted(name: string, items: Array<Record<string, string>>): MetricValue[] {
    const counts = new Map<string, MetricValue>();
    for (const labels of items) {
        const key = JSON.stringify(labels);
        counts.set(key, { name, labels, value: (counts.get(key)?.value ?? 0) + 1 });
    }
    return [...counts.values()];
}

/** Keeps the items of a window, by the time each holds. */
export function inWindow<T>(items: T[], at: (item: T) => string, now: Date, ms: number): T[] {
    return items.filter((item) => Date.parse(at(item)) >= now.getTime() - ms);
}
