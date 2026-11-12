import { useSyncExternalStore } from "react";
import { minuteIn, readableDayIn } from "../../src/time/format.js";
import type { JobRowView } from "../../src/web/api.js";

type Mark = Pick<JobRowView, "applied" | "appliedOn">;

/** Names a row's applied mark for screen readers and hover: one to mark, or the date it was marked once the browser's time zone is known. */
export function rowLabel(job: Mark, timeZone: string | null): string {
    if (!job.applied) return "Mark as applied";
    return job.appliedOn === null || timeZone === null ? "Applied" : `Applied on ${readableDayIn(job.appliedOn, timeZone)}`;
}

/** Gives the panel's Applied fact: the date and time a job was marked, or just that it is applied until the browser's time zone is known. */
export function appliedFact(job: Mark, timeZone: string | null): string {
    if (!job.applied) return "Not applied";
    return job.appliedOn === null || timeZone === null ? "Yes" : minuteIn(job.appliedOn, timeZone);
}

/** Subscribes to time-zone changes, which a page never sees, so there is nothing to undo. */
function noSubscription(): () => void {
    return () => {};
}

/** Reads the browser's own time zone. */
function browserZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Stands in for the browser's time zone while rendering on the server, where it is unknown. */
function serverZone(): string | null {
    return null;
}

/** Gives the browser's time zone, or null on the server and in the first render, so a date never shows in the wrong zone first. */
export function useLocalTimeZone(): string | null {
    return useSyncExternalStore(noSubscription, browserZone, serverZone);
}
