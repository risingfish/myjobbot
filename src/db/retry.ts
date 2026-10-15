export interface RetryOptions {
    tries: number;
    delayMs: number;
    sleep?: (ms: number) => Promise<void>;
}

/** Waits a number of milliseconds. */
function pause(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs an attempt up to a number of tries, waiting between them, and rethrows the last failure. */
export async function withRetry<T>(attempt: () => Promise<T>, { tries, delayMs, sleep = pause }: RetryOptions): Promise<T> {
    for (let tried = 1; ; tried += 1) {
        try {
            return await attempt();
        } catch (error) {
            if (tried >= tries) throw error;
            await sleep(delayMs);
        }
    }
}
