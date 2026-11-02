import { useState } from "react";
import type { JobRowView, RescoreResult } from "../../src/web/api.js";
import { rescoreNote } from "../../src/web/rescoreNote.js";
import { rescoreJob } from "./actions.js";

const FAILED: RescoreResult = { outcome: "failed" };

/** Re-scores a job when pressed, tracking whether it is working and what it said; not useSave, since its answer isn't a save result and its notes aren't save failures. */
export function useRescore(job: JobRowView, onRescored: (row: JobRowView) => void) {
    const [working, setWorking] = useState(false);
    const [note, setNote] = useState<string | null>(null);
    const press = async () => {
        setWorking(true);
        setNote(null);
        const result = await rescoreJob(job.ats, job.jobId).catch(() => FAILED);
        setWorking(false);
        setNote(rescoreNote(result));
        if (result.outcome !== "failed") onRescored(result.row);
    };
    return { working, note, press };
}
