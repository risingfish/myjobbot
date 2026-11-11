const PERIODS = ["day", "week", "month"] as const;

export type Period = (typeof PERIODS)[number];

const DAYS: Record<Period, number> = { day: 1, week: 7, month: 30 };
const MS_PER_DAY = 86_400_000;

/** Gives when a period of the Monitoring page starts, counted back from now. */
export function periodSince(period: Period, now: Date): string {
    return new Date(now.getTime() - DAYS[period] * MS_PER_DAY).toISOString();
}

/** Reads the period a page address asks for, a week for anything that isn't one. */
export function periodOf(value: unknown): Period {
    return PERIODS.find((period) => period === value) ?? "week";
}
