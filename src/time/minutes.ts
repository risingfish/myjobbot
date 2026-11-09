/** Shows a stored UTC time to the minute, as YYYY-MM-DD HH:mm. */
export function minutes(iso: string): string {
    return iso.slice(0, 16).replace("T", " ");
}

/** Shows a stored UTC time to the minute, saying it is UTC. */
export function utcMinutes(iso: string): string {
    return `${minutes(iso)} UTC`;
}
