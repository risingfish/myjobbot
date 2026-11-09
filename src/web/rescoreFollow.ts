import type { RescoreLogStore } from "../db/rescoreLogStore.js";
import { PING, streamEvents, type StreamEvent } from "./rescoreStream.js";

const POLL_MS = 400;
const PING_MS = 5000;

export interface Feed {
    store: Pick<RescoreLogStore, "run" | "stepsAfter">;
    id: string;
    signal: AbortSignal;
    send: (events: StreamEvent[]) => void;
}

export interface FollowClock {
    sleep: (ms: number) => Promise<unknown>;
    now: () => Date;
    clockMs: () => number;
}

interface Tick {
    seq: number;
    ended: boolean;
}

/** Sends what is new every poll, and a heartbeat every few seconds, until the run ends or the browser goes away. */
export async function follow(feed: Feed, after: number, clock: FollowClock): Promise<void> {
    let state = await tick(feed, after, true, clock);
    let pinged = clock.clockMs();
    while (!state.ended && !feed.signal.aborted) {
        await clock.sleep(POLL_MS);
        state = await tick(feed, state.seq, false, clock);
        if (!state.ended && clock.clockMs() - pinged >= PING_MS) {
            feed.send([PING]);
            pinged = clock.clockMs();
        }
    }
}

/** Reads the run, then its steps after the last one sent, so a run read as ended has all its steps; sends them, with the start on the first read. */
async function tick(feed: Feed, seq: number, first: boolean, clock: FollowClock): Promise<Tick> {
    const run = await feed.store.run(feed.id);
    if (run === null) return { seq, ended: true };
    const steps = await feed.store.stepsAfter(feed.id, seq);
    const events = streamEvents(run, steps, clock.now());
    feed.send(first ? events : events.slice(1));
    return { seq: steps.at(-1)?.seq ?? seq, ended: events.at(-1)?.event === "end" };
}
