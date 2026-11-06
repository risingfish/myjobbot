const STEP_UP_MS = 10 * 60 * 1000;

/** Says whether a sensitive change needs the holder of a sign-in to prove their identity again: their last proof is over 10 minutes old. */
export function needsStepUp(session: { verifiedAt: string }, now: string): boolean {
    return Date.parse(now) - Date.parse(session.verifiedAt) > STEP_UP_MS;
}
