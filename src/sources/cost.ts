import type { ApiCallLog } from "../db/apiCallLog.js";
import type { SourceModule, SourcePage } from "./module.js";

/** Records each request a fetched page cost against the paid API its module spends, so the month's budget sees it. */
export async function recordCost(apiCalls: ApiCallLog, module: Pick<SourceModule<unknown>, "limits">, page: SourcePage, spent: { source: string; at: string }): Promise<void> {
    const api = module.limits.spends;
    if (api === null) return;
    for (let request = 0; request < page.cost; request += 1) await apiCalls.record(api, spent.source, spent.at);
}
