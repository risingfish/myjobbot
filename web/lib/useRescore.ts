import { useState } from "react";
import type { JobKey } from "../../src/db/store.js";
import type { RescoreStart } from "../../src/web/api.js";
import { startRescore } from "./actions.js";

const FAILED: RescoreStart = { failed: true };

/** Starts a job's re-score when pressed, tracking whether the start is still on its way, and hands on the run it started or that it failed; not useSave, since its answer isn't a save result. */
export function useRescore(job: JobKey, onStart: (result: RescoreStart) => void) {
    const [working, setWorking] = useState(false);
    const press = async () => {
        setWorking(true);
        const result = await startRescore(job.ats, job.jobId).catch(() => FAILED);
        setWorking(false);
        onStart(result);
    };
    return { working, press };
}
