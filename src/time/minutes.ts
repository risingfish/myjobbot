import { minuteIn } from "./format.js";

/** Shows a stored UTC time to the minute, as YYYY-MM-DD HH:mm. */
export function minutes(iso: string): string {
    return minuteIn(iso, "utc");
}

/** Shows a stored UTC time to the minute, saying it is UTC. */
export function utcMinutes(iso: string): string {
    return `${minutes(iso)} UTC`;
}
