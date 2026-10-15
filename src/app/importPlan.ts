const LIMITS: Record<string, Record<string, number>> = {
    jobs: {
        ats: 32,
        job_id: 255,
        company: 255,
        source: 255,
        title: 500,
        normalized_title: 500,
        location: 255,
        department: 255,
        team: 255,
        workplace_type: 255,
        compensation: 255,
        publisher: 255,
        url: 2048,
        posted_at: 32,
        first_seen: 32,
        last_seen: 32,
        scored_at: 32,
        emailed_at: 32,
    },
    verdicts: { ats: 32, job_id: 255, run_id: 64, scored_at: 32 },
    api_calls: { api: 32, source: 255, called_at: 32 },
};

/** Lists the values in a row that are longer than their column allows, as "table.column (length > limit)". */
export function oversizedValues(table: string, row: Record<string, unknown>): string[] {
    const limits = LIMITS[table] ?? {};
    return Object.entries(limits).flatMap(([column, limit]) => {
        const value = row[column];
        const length = typeof value === "string" ? [...value].length : 0;
        return length > limit ? [`${table}.${column} (${length} > ${limit})`] : [];
    });
}

/** Splits rows into consecutive batches of at most a given size. */
export function batches<T>(rows: T[], size: number): T[][] {
    const groups: T[][] = [];
    for (let start = 0; start < rows.length; start += size) groups.push(rows.slice(start, start + size));
    return groups;
}

/** Picks up to a number of row positions spread evenly across a table, the same ones every time. */
export function sampleIndexes(count: number, wanted: number): number[] {
    if (count <= wanted) return Array.from({ length: count }, (_, index) => index);
    const step = Math.floor(count / wanted);
    return Array.from({ length: wanted }, (_, index) => index * step);
}

/** Names every table whose copied row count differs from the source's. */
export function compareCounts(expected: Record<string, number>, actual: Record<string, number>): string[] {
    return Object.entries(expected)
        .filter(([table, count]) => actual[table] !== count)
        .map(([table, count]) => `${table}: expected ${count}, found ${actual[table] ?? 0}`);
}
