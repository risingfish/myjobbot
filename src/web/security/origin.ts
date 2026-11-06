export interface OriginInput {
    method: string;
    origin: string | null;
    fetchSite: string | null;
}

/** Says whether a request is a plain read. */
export function isRead(method: string): boolean {
    return method === "GET" || method === "HEAD";
}

/** Says whether a request may go on: reads always, changes only when sent from the UI's own origin. */
export function checkOrigin(input: OriginInput, baseOrigin: string): boolean {
    if (isRead(input.method)) return true;
    if (input.fetchSite !== null && input.fetchSite !== "same-origin") return false;
    return input.origin === baseOrigin;
}
