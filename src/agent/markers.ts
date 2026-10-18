export interface DataMarkers {
    tag: string;
    open: string;
    close: string;
}

export interface Lookalike {
    tool: string;
    jobId: string | null;
}

type Hit = Pick<Lookalike, "jobId">;

const TAG_LENGTH = 12;
const LOOKALIKE = /<<\s*\/?\s*data/gi;

/** Builds the markers that bound outside text for one run, from the run's random id. */
export function dataMarkers(runId: string): DataMarkers {
    const tag = runId.replaceAll("-", "").slice(0, TAG_LENGTH);
    return { tag, open: `<<data ${tag}>>`, close: `<</data ${tag}>>` };
}

/** Removes every look-alike marker from the strings in a value, noting which job each one was in. */
export function scrub(value: unknown): { value: unknown; hits: Hit[] } {
    const hits: Hit[] = [];
    return { value: walk(value, null, hits), hits };
}

/** Removes every look-alike marker from one piece of text, saying how many were removed. */
export function scrubText(text: string): { text: string; removed: number } {
    const hits: Hit[] = [];
    return { text: clean(text, null, hits), removed: hits.length };
}

/** Cleans one value, passing down the job id of the nearest enclosing object that has one. */
function walk(value: unknown, jobId: string | null, hits: Hit[]): unknown {
    if (typeof value === "string") return clean(value, jobId, hits);
    if (Array.isArray(value)) return value.map((item) => walk(item, jobId, hits));
    if (value === null || typeof value !== "object") return value;
    const own = "job_id" in value && typeof value.job_id === "string" ? value.job_id : jobId;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item, own, hits)]));
}

/** Removes look-alike marker starts from a string until none is left, so joined pieces are caught too. */
function clean(text: string, jobId: string | null, hits: Hit[]): string {
    let current = text;
    for (;;) {
        const next = current.replace(LOOKALIKE, () => {
            hits.push({ jobId });
            return "";
        });
        if (next === current) return current;
        current = next;
    }
}
