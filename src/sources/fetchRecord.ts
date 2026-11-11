import type { FetchRecord } from "../db/fetchHistory.js";
import type { SavedSource } from "../db/sourceStore.js";
import type { ToolContext } from "../tools/context.js";

export type RecordContext = Pick<ToolContext, "fetches" | "runId" | "now" | "trace">;

export type FetchDone = Pick<FetchRecord, "at" | "outcome" | "reason" | "pages" | "jobs" | "cost">;

/** Adds one fetch, or planned skip, to the fetch history under the run part, timed from when it started; a record that fails is traced and never stops the fetch phase. */
export async function recordFetch(context: RecordContext, saved: SavedSource, done: FetchDone): Promise<void> {
    const ms = Math.max(0, context.now().getTime() - Date.parse(done.at));
    try {
        await context.fetches.record({ sourceId: saved.id, partId: context.runId, module: saved.module, ms, ...done });
    } catch {
        context.trace.write({ type: "fetch_history_failed", source: saved.name });
    }
}
