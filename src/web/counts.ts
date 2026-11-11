export interface CountRow {
    label: string;
    count: number;
}

const NO_DURATION = "—";
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

/** Counts items by a label, most common first, then by label. */
export function countBy<T>(items: T[], labelOf: (item: T) => string): CountRow[] {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(labelOf(item), (counts.get(labelOf(item)) ?? 0) + 1);
    return [...counts].map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

/** Shows a length of time as minutes and seconds, or a dash when there is none. */
export function durationText(ms: number | null): string {
    if (ms === null) return NO_DURATION;
    const seconds = Math.round(ms / MS_PER_SECOND);
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds % SECONDS_PER_MINUTE}s`;
}
