export interface RetryOptions {
    tries: number;
    delayMs: number;
    sleep?: (ms: number) => Promise<void>;
    retryable?: (error: unknown) => boolean;
}

const DEADLOCK = 1213;

/** Waits a number of milliseconds. */
function pause(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Says whether a database error is MariaDB choosing this transaction as a deadlock's victim, which is safe to run again. */
export function isDeadlock(error: unknown): boolean {
    return typeof error === "object" && error !== null && "errno" in error && error.errno === DEADLOCK;
}

/** Runs an attempt up to a number of tries, waiting between them, and rethrows the last failure or one that can't be retried. */
export async function withRetry<T>(attempt: () => Promise<T>, { tries, delayMs, sleep = pause, retryable = () => true }: RetryOptions): Promise<T> {
    for (let tried = 1; ; tried += 1) {
        try {
            return await attempt();
        } catch (error) {
            if (tried >= tries || !retryable(error)) throw error;
            await sleep(delayMs);
        }
    }
}
