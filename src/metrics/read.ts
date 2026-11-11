import type { SharedStores } from "../db/store.js";
import { requestsThisMonth } from "../tools/searchBudget.js";
import { metricsText } from "./registry.js";
import type { Snapshot } from "./snapshot.js";
import { metricValues } from "./values.js";

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 30;
const WORK_DAYS = 7;

/** Reads what one scrape reports from the stored history: 30 days of runs, fetches and mail for the latest run and the streaks, 7 days of lookups and re-scores, and this month's JSearch requests. */
async function readSnapshot(stores: Pick<SharedStores, "monitoring" | "apiCalls">, jsearchCap: number, now: Date): Promise<Snapshot> {
    const back = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();
    const { monitoring } = stores;
    const [runs, fetches, lookups, rescores, mails] = await Promise.all([monitoring.runs(back(HISTORY_DAYS)), monitoring.fetches(back(HISTORY_DAYS)), monitoring.lookups(back(WORK_DAYS)), monitoring.rescores(back(WORK_DAYS)), monitoring.mails(back(HISTORY_DAYS))]);
    return { now, runs, fetches, lookups, rescores, mails, jsearchUsed: await requestsThisMonth({ apiCalls: stores.apiCalls, now: () => now }), jsearchCap };
}

/** Renders one scrape's exposition text from the stored history. */
export async function renderMetrics(stores: Pick<SharedStores, "monitoring" | "apiCalls">, jsearchCap: number, now: Date): Promise<string> {
    return metricsText(metricValues(await readSnapshot(stores, jsearchCap, now)));
}
