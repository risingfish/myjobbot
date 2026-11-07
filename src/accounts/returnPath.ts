const MAX_LENGTH = 512;
const CONTROL = /[\u0000-\u001f\u007f]/;

/** Decodes a value once, or returns null when it isn't valid percent-encoding. */
function decodedOnce(value: string): string | null {
    try {
        return decodeURIComponent(value);
    } catch {
        return null;
    }
}

/** Says whether a path stays on the UI: one leading slash, no backslash, no control characters. */
function staysHere(path: string): boolean {
    return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") && !CONTROL.test(path) && path.length <= MAX_LENGTH;
}

/** Returns the page to go back to after signing in, or the home page when the one given could leave the UI. */
export function safeReturnPath(next: string | null | undefined): string {
    if (!next) return "/";
    const decoded = decodedOnce(next);
    return decoded !== null && staysHere(next) && staysHere(decoded) ? next : "/";
}
