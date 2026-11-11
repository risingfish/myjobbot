import { memoryStores, type TestStores } from "./helpers/memoryStore.js";
import { monitoringStrictCases, runHistoryCases, type MonitoringHooks } from "./helpers/monitoringContract.js";

function memoryHooks(stores: TestStores): MonitoringHooks {
    const history = stores.memory?.runHistory;
    return {
        run: async (runId) => history?.runs.find((run) => run.id === runId) ?? null,
        parts: async (runId) => history?.parts.filter((part) => part.runId === runId) ?? [],
    };
}

const make = async () => memoryStores();

runHistoryCases(make, memoryHooks);
monitoringStrictCases(make, memoryHooks);
