import { minuteIn } from "../time/format.js";

/** Shows a stored UTC time as YYYY-MM-DD HH:mm in the server's time zone, or null when there is none. */
export function localTime(iso: string | null): string | null {
    return iso === null ? null : minuteIn(iso);
}
