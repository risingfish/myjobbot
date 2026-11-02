import { useEffect, useState } from "react";
import type { JobKey } from "../../src/db/store.js";
import type { JobDetailView } from "../../src/web/api.js";
import { loadJobDetails } from "./actions.js";

export type Details = { state: "loading" } | { state: "found"; view: JobDetailView } | { state: "missing" } | { state: "failed"; error: string };

interface Answer {
    ats: string;
    jobId: string;
    details: Details;
}

const LOADING: Details = { state: "loading" };

/** Loads the shown job's details each time another job is shown or the refresh count moves on, ignoring answers for a job that is no longer shown. */
export function useJobDetails(key: JobKey | null, refresh = 0): Details {
    const ats = key?.ats ?? null;
    const jobId = key?.jobId ?? null;
    const [answer, setAnswer] = useState<Answer | null>(null);
    useEffect(() => {
        if (ats === null || jobId === null) return;
        let current = true;
        const settle = (details: Details) => current && setAnswer({ ats, jobId, details });
        void loadJobDetails(ats, jobId).then(
            (view) => settle(view === null ? { state: "missing" } : { state: "found", view }),
            (error: unknown) => settle({ state: "failed", error: error instanceof Error ? error.message : String(error) }),
        );
        return () => {
            current = false;
        };
    }, [ats, jobId, refresh]);
    return answer !== null && answer.ats === ats && answer.jobId === jobId ? answer.details : LOADING;
}
