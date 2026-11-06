import { useEffect, useEffectEvent, useState, type Dispatch, type SetStateAction } from "react";
import type { RescoreEnd } from "../../src/db/rescoreLogStore.js";
import { afterStreamFailure } from "../../src/web/signedOut.js";

const QUIET_MS = 15_000;

interface LogLine {
    seq: number;
    elapsedMs: number;
    line: string;
}

interface LogState {
    lines: LogLine[];
    end: RescoreEnd | null;
    lost: boolean;
}

const EMPTY: LogState = { lines: [], end: null, lost: false };

/** Follows one re-score's log from the server as it runs, until it ends or the live view is lost. */
export function useRescoreLog(run: string, onEnd: (end: RescoreEnd) => void): LogState {
    const [state, setState] = useState(EMPTY);
    const ended = useEffectEvent(onEnd);
    useEffect(() => new LiveLog(new EventSource(`/api/rescores/${encodeURIComponent(run)}`), setState, ended).listen(), [run]);
    return state;
}

/** One run's live stream: routes its events into the log's state and notices when it ends, closes, or goes quiet. */
class LiveLog {
    private quiet: ReturnType<typeof setTimeout> | undefined;
    private readonly source: EventSource;
    private readonly setState: Dispatch<SetStateAction<LogState>>;
    private readonly onEnd: (end: RescoreEnd) => void;

    /** Keeps the stream and where its events go. */
    constructor(source: EventSource, setState: Dispatch<SetStateAction<LogState>>, onEnd: (end: RescoreEnd) => void) {
        this.source = source;
        this.setState = setState;
        this.onEnd = onEnd;
    }

    /** Starts listening, giving what stops it. */
    listen(): () => void {
        this.on("start", () => {});
        this.on("ping", () => {});
        this.on("step", (data) => this.setState((state) => withLine(state, data as LogLine)));
        this.on("end", (data) => this.ended(data as RescoreEnd));
        this.source.onerror = () => void (this.source.readyState === EventSource.CLOSED && this.lose());
        this.heard();
        return () => this.stop();
    }

    /** Handles one kind of event, each counting as a sign the stream is alive. */
    private on(name: string, handle: (data: unknown) => void) {
        this.source.addEventListener(name, (event) => {
            this.heard();
            handle(JSON.parse((event as MessageEvent<string>).data));
        });
    }

    /** Restarts the wait after which a silent stream counts as lost. */
    private heard() {
        clearTimeout(this.quiet);
        this.quiet = setTimeout(() => this.lose(), QUIET_MS);
    }

    /** Records how the run ended and stops listening. */
    private ended(end: RescoreEnd) {
        this.stop();
        this.setState((state) => ({ ...state, end }));
        this.onEnd(end);
    }

    /** Marks the live view lost and stops listening, then asks the stream's address once whether the browser was signed out. */
    private lose() {
        this.stop();
        this.setState((state) => ({ ...state, lost: true }));
        void fetch(this.source.url, { method: "HEAD" })
            .then((answer) => this.signedOut(answer.status))
            .catch(() => this.signedOut(0));
    }

    /** Sends the page to sign in, showing no log lines, when the stream's address answers that the browser is signed out. */
    private signedOut(status: number) {
        const target = afterStreamFailure(status, `${window.location.pathname}${window.location.search}`);
        if (target === null) return;
        this.setState(EMPTY);
        window.location.assign(target);
    }

    /** Stops the wait and closes the stream. */
    private stop() {
        clearTimeout(this.quiet);
        this.source.close();
    }
}

/** Adds a step's line unless it was already shown, as after the browser reconnects. */
function withLine(state: LogState, line: LogLine): LogState {
    const last = state.lines.at(-1)?.seq ?? 0;
    return line.seq > last ? { ...state, lines: [...state.lines, line] } : state;
}
