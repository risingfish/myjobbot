import type { MailRow, RescoreRow } from "../db/monitoringReads.js";
import { runEnd } from "../db/rescoreLogStore.js";
import { countBy, durationText, type CountRow } from "./counts.js";

interface RescoreView {
    outcomes: CountRow[];
    typical: string;
    longest: string;
    model: string;
}

/** Gives the middle value of some numbers, or null for none. */
function median(values: number[]): number | null {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted.length === 0 ? null : (sorted[Math.floor((sorted.length - 1) / 2)] ?? null);
}

/** Counts the period's re-scores by how they ended, one open too long counted as failed, with their typical and longest durations and their model use. */
export function rescoreRows(rescores: RescoreRow[], now: Date): RescoreView {
    const durations = rescores.flatMap((row) => (row.endedAt === null ? [] : [Date.parse(row.endedAt) - Date.parse(row.startedAt)]));
    const calls = rescores.reduce((sum, row) => sum + row.modelCalls, 0);
    const tokens = rescores.reduce((sum, row) => sum + row.promptTokens + row.completionTokens, 0);
    const outcomes = countBy(rescores, (row) => runEnd(row, now)?.outcome ?? "running");
    return { outcomes, typical: durationText(median(durations)), longest: durationText(durations.length === 0 ? null : Math.max(...durations)), model: `${calls} calls, ${tokens} tokens` };
}

/** Counts the period's mail by kind and outcome, and its failures by their fixed reason. */
export function mailRows(mails: MailRow[]): { sends: CountRow[]; failures: CountRow[] } {
    return { sends: countBy(mails, (mail) => `${mail.kind} ${mail.outcome}`), failures: countBy(mails.filter((mail) => mail.outcome === "failed"), (mail) => mail.reason ?? "other") };
}
