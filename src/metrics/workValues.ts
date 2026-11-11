import type { LookupRow, RescoreRow } from "../db/monitoringReads.js";
import { runEnd, type ModelUse } from "../db/rescoreLogStore.js";
import type { MetricValue } from "./definitions.js";
import { counted, inWindow, WINDOWS, type Snapshot } from "./snapshot.js";

const READ_BY: Record<string, string> = { board: "board", html: "download", rendered: "browser" };
const SECONDS = 1000;

/** Adds up model calls and tokens. */
function used(rows: ModelUse[]): ModelUse {
    return rows.reduce((sum, row) => ({ modelCalls: sum.modelCalls + row.modelCalls, promptTokens: sum.promptTokens + row.promptTokens, completionTokens: sum.completionTokens + row.completionTokens }), { modelCalls: 0, promptTokens: 0, completionTokens: 0 });
}

/** Gives one worker's model calls and tokens in a window. */
function modelValues(worker: string, rows: ModelUse[], window: string): MetricValue[] {
    const use = used(rows);
    return [
        { name: "myjobbot_model_calls", labels: { worker, window }, value: use.modelCalls },
        { name: "myjobbot_model_tokens", labels: { worker, kind: "prompt", window }, value: use.promptTokens },
        { name: "myjobbot_model_tokens", labels: { worker, kind: "completion", window }, value: use.completionTokens },
    ];
}

/** Gives one window's careers lookups by how they ended and their page reads by how each page was read. */
function lookupValues(lookups: LookupRow[], window: string): MetricValue[] {
    const reads = lookups.filter((row) => row.step !== "finish" && row.pageSource !== null);
    return [...counted("myjobbot_careers_lookups", lookups.filter((row) => row.step === "finish").map((row) => ({ outcome: row.outcome === "found" ? "found" : "not_found", window }))), ...counted("myjobbot_careers_page_reads", reads.map((row) => ({ read_by: READ_BY[row.pageSource ?? ""] ?? "other", window })))];
}

/** Gives one window's re-scores by how they ended, one open too long counted failed, and the longest that ended. */
function rescoreValues(rescores: RescoreRow[], now: Date, window: string): MetricValue[] {
    const durations = rescores.flatMap((row) => (row.endedAt === null ? [] : [(Date.parse(row.endedAt) - Date.parse(row.startedAt)) / SECONDS]));
    return [...counted("myjobbot_rescores", rescores.map((row) => ({ outcome: runEnd(row, now)?.outcome ?? "running", window }))), { name: "myjobbot_rescore_duration_seconds_max", labels: { window }, value: Math.max(0, ...durations) }];
}

/** Gives one window's lookups, company searches, re-scores, model use and mail. */
function windowValues(snapshot: Snapshot, window: string, ms: number): MetricValue[] {
    const { now } = snapshot;
    const runs = inWindow(snapshot.runs, (run) => run.startedAt, now, ms).map((run) => run.totals);
    const rescores = inWindow(snapshot.rescores, (row) => row.startedAt, now, ms);
    const searches = runs.reduce((sum, totals) => ({ searched: sum.searched + totals.searches, failed: sum.failed + totals.searchFailures }), { searched: 0, failed: 0 });
    return [
        ...lookupValues(inWindow(snapshot.lookups, (row) => row.at, now, ms), window),
        ...Object.entries(searches).map(([outcome, value]) => ({ name: "myjobbot_company_searches", labels: { outcome, window }, value })),
        ...rescoreValues(rescores, now, window),
        ...modelValues("run", runs, window),
        ...modelValues("rescore", rescores, window),
        ...counted("myjobbot_mail_sends", inWindow(snapshot.mails, (mail) => mail.at, now, ms).map((mail) => ({ kind: mail.kind, outcome: mail.outcome, window }))),
    ];
}

/** Gives the mail failures since the last mail sent. */
function mailStreak(mails: Snapshot["mails"]): number {
    const lastSent = mails.map((mail) => mail.outcome).lastIndexOf("sent");
    return mails.slice(lastSent + 1).filter((mail) => mail.outcome === "failed").length;
}

/** Gives each window's lookups, searches, re-scores, model use and mail, the mail failure streak and the share of the JSearch budget used. */
export function workValues(snapshot: Snapshot): MetricValue[] {
    const ratio = snapshot.jsearchCap === 0 ? 0 : snapshot.jsearchUsed / snapshot.jsearchCap;
    return [...WINDOWS.flatMap(({ window, ms }) => windowValues(snapshot, window, ms)), { name: "myjobbot_mail_failure_streak", labels: {}, value: mailStreak(snapshot.mails) }, { name: "myjobbot_jsearch_budget_used_ratio", labels: {}, value: ratio }];
}
