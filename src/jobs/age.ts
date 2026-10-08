export const MS_PER_DAY = 86_400_000;

/** Returns the whole days elapsed since a date, used for a job's days open and ghost checks. */
export function daysBetween(earlierIso: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(earlierIso)) / MS_PER_DAY);
}
