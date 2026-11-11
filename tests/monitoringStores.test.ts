import { memoryStores, type TestStores } from "./helpers/memoryStore.js";
import { fetchHistoryCases, mailLogCases, monitoringReadCases, monitoringStrictCases, runHistoryCases, type MonitoringHooks } from "./helpers/monitoringContract.js";

function memoryHooks(stores: TestStores): MonitoringHooks {
    const history = stores.memory?.runHistory;
    return {
        run: async (runId) => history?.runs.find((run) => run.id === runId) ?? null,
        parts: async (runId) => history?.parts.filter((part) => part.runId === runId) ?? [],
        fetches: async (userId) => {
            const sources = new Set((await stores.forUser(userId).sources.list()).map((source) => source.id));
            return stores.memory?.fetchHistory.fetches.filter((fetch) => fetch.userId === userId && sources.has(fetch.sourceId)) ?? [];
        },
        mails: async () => stores.memory?.mailLog.sends ?? [],
    };
}

const make = async () => memoryStores();

runHistoryCases(make, memoryHooks);
fetchHistoryCases(make, memoryHooks);
mailLogCases(make, memoryHooks);
monitoringReadCases(make, memoryHooks);
monitoringStrictCases(make, memoryHooks);
