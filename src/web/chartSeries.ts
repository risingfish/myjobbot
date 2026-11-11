export interface ChartSeries {
    labels: string[];
    sets: Array<{ name: string; values: number[] }>;
}

/** Counts items for each day they fall on, oldest day first, one series for each name in the order first seen. */
export function perDay<T>(items: T[], dayOf: (item: T) => string, nameOf: (item: T) => string): ChartSeries {
    const labels = [...new Set(items.map(dayOf))].sort();
    const names = [...new Set(items.map(nameOf))];
    const sets = names.map((name) => ({ name, values: labels.map((day) => items.filter((item) => dayOf(item) === day && nameOf(item) === name).length) }));
    return { labels, sets };
}
