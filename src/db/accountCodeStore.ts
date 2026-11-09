export const CODE_DAYS = 7;

export interface AccountCodeStore {
    makeCode(digest: string, createdBy: number, now: string): Promise<void>;
}

/** Returns the time a number of days after another, as an ISO string. */
export function daysAfter(now: string, days: number): string {
    return new Date(Date.parse(now) + days * 24 * 60 * 60 * 1000).toISOString();
}
