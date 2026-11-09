import { setTimeout as sleep } from "node:timers/promises";
import type { RescoreLogStore } from "../../../../../src/db/rescoreLogStore.js";
import { follow } from "../../../../../src/web/rescoreFollow.js";
import { sseText, type StreamEvent } from "../../../../../src/web/rescoreStream.js";
import { currentSession } from "../../../../lib/currentSession.js";
import { openedStores } from "../../../../lib/database.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEADERS = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" };

export const dynamic = "force-dynamic";

/** Streams a re-score's start, its steps as they are stored, and its end, as server-sent events. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
    const { id } = await params;
    if (!UUID.test(id)) return new Response(null, { status: 404 });
    const signedIn = await currentSession();
    if (signedIn === null) return new Response(null, { status: 404 });
    const store = (await openedStores()).forUser(signedIn.account.id).rescoreLog;
    if ((await store.run(id)) === null) return new Response(null, { status: 404 });
    const after = Number.parseInt(request.headers.get("last-event-id") ?? "0", 10);
    return new Response(followed(store, id, { signal: request.signal, after: Number.isNaN(after) ? 0 : after }), { headers: HEADERS });
}

/** Answers a check that the stream's address is reachable while signed in, without opening the stores or following anything. */
export function HEAD(): Response {
    return new Response(null, { status: 204 });
}

/** Builds the response body that follows one run until it ends or the browser goes away. */
function followed(store: RescoreLogStore, id: string, { signal, after }: { signal: AbortSignal; after: number }): ReadableStream<Uint8Array> {
    const stop = new AbortController();
    const done = AbortSignal.any([signal, stop.signal]);
    const encoder = new TextEncoder();
    return new ReadableStream({
        start: (controller) => {
            const send = (events: StreamEvent[]) => void (done.aborted || events.length === 0 || controller.enqueue(encoder.encode(sseText(events))));
            void follow({ store, id, signal: done, send }, after, { sleep, now: () => new Date(), clockMs: Date.now })
                .catch((error: unknown) => console.error("rescore stream failed", error instanceof Error ? error.message : "unknown"))
                .finally(() => void (done.aborted || controller.close()));
        },
        cancel: () => stop.abort(),
    });
}
