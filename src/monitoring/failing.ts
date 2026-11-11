const REPEATED = 3;

/** Tells whether a source keeps failing: its latest 3 fetches, newest first, all failed. */
export function failingRepeatedly(outcomes: string[]): boolean {
    return outcomes.length >= REPEATED && outcomes.slice(0, REPEATED).every((outcome) => outcome === "failing");
}
