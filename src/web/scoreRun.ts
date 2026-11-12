import type { JobDetailView } from "./api.js";

/** Finds the run that gave a job its current score: the history's verdict scored at the same minute, or null when none matches. */
export function scoreRun(view: Pick<JobDetailView, "score" | "history">): string | null {
    const scoredAt = view.score?.scoredAt ?? null;
    if (scoredAt === null) return null;
    return view.history.find((entry) => entry.total !== null && entry.scoredAt === scoredAt)?.run ?? null;
}
