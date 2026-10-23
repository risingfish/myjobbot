type Saved<R> = Extract<R, { ok: true }>;

/** Tells whether a server action's result is a saved change. */
function isSaved<R extends { ok: boolean }>(result: R | null): result is Saved<R> {
    return result?.ok === true;
}

/** Picks out a saved change from a server action's result, or null when the change was refused or the request failed. */
export function saveOutcome<R extends { ok: boolean }>(result: R | null): Saved<R> | null {
    return isSaved(result) ? result : null;
}
