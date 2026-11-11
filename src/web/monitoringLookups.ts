import type { LookupRow, RunRow } from "../db/monitoringReads.js";
import { countBy, type CountRow } from "./counts.js";

const READ_BY: Record<string, string> = { board: "board data", html: "download", rendered: "browser" };

/** Says how one lookup ended, with its fixed reason when it found nothing. */
function finishLabel(row: LookupRow): string {
    return row.outcome === "found" ? "found" : `not found: ${row.reason ?? "unknown"}`;
}

/** Counts the careers lookups in the period by how they ended, and their page reads by how each page was read. */
export function lookupRows(lookups: LookupRow[]): { outcomes: CountRow[]; pages: CountRow[] } {
    const pages = lookups.filter((row) => row.step !== "finish" && row.pageSource !== null);
    return { outcomes: countBy(lookups.filter((row) => row.step === "finish"), finishLabel), pages: countBy(pages, (row) => READ_BY[row.pageSource ?? ""] ?? "other") };
}

/** Adds up the company searches the period's runs made, and how many of their search steps failed. */
export function searchRow(runs: RunRow[]): { searched: number; failed: number } {
    return runs.reduce((sum, run) => ({ searched: sum.searched + run.totals.searches, failed: sum.failed + run.totals.searchFailures }), { searched: 0, failed: 0 });
}
