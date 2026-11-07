import { safeReturnPath } from "../accounts/returnPath.js";

/** Returns the sign-in page's address, returning to a page on the UI, or to the home page when the page could leave it. */
function signInPath(page: string | null): string {
    const next = safeReturnPath(page);
    return next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;
}

/** Returns where a signed-out action goes: the sign-in page, returning to the page it came from when that page is the UI's own. */
export function signInFromReferer(referer: string | null, baseOrigin: string): string {
    if (referer === null || !URL.canParse(referer)) return "/sign-in";
    const url = new URL(referer);
    return url.origin === baseOrigin ? signInPath(`${url.pathname}${url.search}`) : "/sign-in";
}

/** Returns where the page goes when its live stream fails: the sign-in page when the stream's address says signed out, else nowhere. */
export function afterStreamFailure(status: number, page: string): string | null {
    return status === 401 ? signInPath(page) : null;
}
