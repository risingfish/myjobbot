import { createServer, type Server } from "node:http";
import { loadConfig, type Environment } from "../config/load.js";
import { runtimeSettings } from "../config/resolve.js";
import { openStores } from "../db/connect.js";
import { parseDbSettings } from "../db/settings.js";
import type { Stores } from "../db/store.js";
import { renderMetrics } from "./read.js";
import { metricsHandler } from "./server.js";
import { metricsToken } from "./token.js";

const DEFAULT_PORT = 9464;
const NO_TOKEN = "myjobbot: set MYJOBBOT_METRICS_TOKEN to a secret of at least 32 characters before serving metrics";

/** Waits for the process to be told to stop, then closes the server and the stores. */
function closedOnSignal(server: Server, stores: Stores): Promise<void> {
    return new Promise((resolve) => {
        const stop = () => server.close(() => void stores.close().then(resolve));
        process.once("SIGTERM", stop);
        process.once("SIGINT", stop);
    });
}

/** Serves the metrics for Prometheus on their own port, behind the token, from the stored history, until told to stop; refuses to start without a valid token. */
export async function metricsCommand(environment: Environment): Promise<number> {
    const token = metricsToken(environment);
    if (token === null) {
        console.error(NO_TOKEN);
        return 1;
    }
    const cap = runtimeSettings(loadConfig(environment).fileRaw).jsearch.monthly_request_cap;
    const stores = await openStores(parseDbSettings(environment));
    const port = Number(environment.MYJOBBOT_METRICS_PORT ?? DEFAULT_PORT);
    const server = createServer(metricsHandler({ token, render: () => renderMetrics(stores, cap, new Date()) }));
    await new Promise<void>((resolve) => server.listen(port, resolve));
    console.log(`myjobbot: serving metrics on port ${port}`);
    await closedOnSignal(server, stores);
    return 0;
}
