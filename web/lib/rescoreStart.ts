import type { JobKey } from "../../src/db/store.js";
import type { OpenedRescore } from "../../src/rescore/open.js";
import { rescore } from "../../src/rescore/rescore.js";
import type { RescoreStart } from "../../src/web/api.js";
import { jobRequest } from "./rows.js";

type StartedRescore = RescoreStart | { run: string; work: () => Promise<void> };

/** Starts one job's re-score for its panel: refuses a malformed request before any work, gives the run already open for the job, or records a new run and gives the work that carries it out. */
export async function startRescoreFor(open: () => Promise<OpenedRescore>, request: unknown): Promise<StartedRescore> {
    const parsed = jobRequest.safeParse(request);
    if (!parsed.success) return { failed: true };
    const opened = await open();
    const begun = await opened.begin(parsed.data).catch(async (error: unknown) => {
        await opened.close();
        throw error;
    });
    if ("started" in begun) return { run: begun.started, work: () => carriedOut(opened, parsed.data) };
    await opened.close();
    return "running" in begun ? { run: begun.running } : { failed: true };
}

/** Runs a started re-score to its end, then closes what it opened. */
async function carriedOut(opened: OpenedRescore, key: JobKey): Promise<void> {
    try {
        await rescore(opened.deps, key);
    } finally {
        await opened.close();
    }
}
