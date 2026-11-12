import { DateTime } from "luxon";

const DAY = "yyyy-MM-dd";
const MINUTE = "yyyy-MM-dd HH:mm";

/** Reads a stored UTC time as it falls in the given time zone, or in the process's own zone when none is given. */
function inZone(iso: string, zone = "local"): DateTime {
    return DateTime.fromISO(iso, { zone: "utc" }).setZone(zone);
}

/** Shows a stored UTC time as the date, YYYY-MM-DD, it falls on in the given time zone, or the process's own. */
export function dayIn(iso: string, zone?: string): string {
    return inZone(iso, zone).toFormat(DAY);
}

/** Shows a stored UTC time to the minute, as YYYY-MM-DD HH:mm, in the given time zone, or the process's own. */
export function minuteIn(iso: string, zone?: string): string {
    return inZone(iso, zone).toFormat(MINUTE);
}
