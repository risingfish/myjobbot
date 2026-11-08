import { setTimeout as sleep } from "node:timers/promises";
import type { RescoreLogStore } from "../../../../../src/db/rescoreLogStore.js";
import { PING, sseText, streamEvents, type StreamEvent } from "../../../../../src/web/rescoreStream.js";
import { OWNER_ID } from "../../../../../src/db/searchSettingsStore.js";
import { openedStores } from "../../../../lib/database.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POLL_MS = 400;
const PING_MS = 5000;
const HEADERS = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" };

export const dynamic = "force-dynamic";

interface Feed {
    store: RescoreLogStore;
    id: string;
    signal: AbortSignal;
    send: (events: StreamEvent[]) => void;
}

interface Tick {
    seq: number;
    ended: boolean;
}

/** Streams a re-score's start, its steps as they are stored, and its end, as server-sent events. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
    const { id } = await params;
    if (!UUID.test(id)) return new Response(null, { status: 404 });
    const store = (await openedStores()).forUser(OWNER_ID).rescoreLog;
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
            void follow({ store, id, signal: done, send }, after)
                .catch((error: unknown) => console.error("rescore stream failed", error instanceof Error ? error.message : "unknown"))
                .finally(() => void (done.aborted || controller.close()));
        },
        cancel: () => stop.abort(),
    });
}

/** Sends what is new every poll, and a heartbeat every few seconds, until the run ends. */
async function follow(feed: Feed, after: number): Promise<void> {
    let state = await tick(feed, after, true);
    let pinged = Date.now();
    while (!state.ended && !feed.signal.aborted) {
        await sleep(POLL_MS);
        state = await tick(feed, state.seq, false);
        if (!state.ended && Date.now() - pinged >= PING_MS) {
            feed.send([PING]);
            pinged = Date.now();
        }
    }
}

/** Reads the run, then its steps after the last one sent, so a run read as ended has all its steps; sends them, with the start on the first read. */
async function tick(feed: Feed, seq: number, first: boolean): Promise<Tick> {
    const run = await feed.store.run(feed.id);
    if (run === null) return { seq, ended: true };
    const steps = await feed.store.stepsAfter(feed.id, seq);
    const events = streamEvents(run, steps, new Date());
    feed.send(first ? events : events.slice(1));
    return { seq: steps.at(-1)?.seq ?? seq, ended: events.at(-1)?.event === "end" };
}
