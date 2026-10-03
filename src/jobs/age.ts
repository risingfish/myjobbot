export const MS_PER_DAY = 86_400_000;

export function daysBetween(earlierIso: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(earlierIso)) / MS_PER_DAY);
}
