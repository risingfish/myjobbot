import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";
import { METRICS_CONTENT_TYPE } from "./registry.js";
import { tokenOk } from "./token.js";

interface MetricsDeps {
    token: string;
    render: () => Promise<string>;
}

const READ_FAILED = "metrics_read_failed";

/** Ends a response with a status and nothing else. */
function bare(response: ServerResponse, status: number): void {
    response.writeHead(status).end();
}

/** Answers one request: the metrics for GET /metrics with the token, 401 without it, 404 for anything else, 503 when the history can't be read, every refusal with an empty body. */
async function answer(deps: MetricsDeps, request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method !== "GET" || request.url !== "/metrics") return bare(response, 404);
    if (!tokenOk(request.headers.authorization, deps.token)) return bare(response, 401);
    try {
        const body = await deps.render();
        response.writeHead(200, { "content-type": METRICS_CONTENT_TYPE }).end(body);
    } catch {
        console.error(READ_FAILED);
        bare(response, 503);
    }
}

/** Gives the metrics server's request handler. */
export function metricsHandler(deps: MetricsDeps): RequestListener {
    return (request, response) => void answer(deps, request, response);
}
