import type { BrowserPort, BrowserTab, RoutedRequest } from "../../src/careers/browser.js";

type BrowserSession = Awaited<ReturnType<BrowserPort["session"]>>;
type SessionOptions = Parameters<BrowserPort["session"]>[0];

interface FakeScript {
    html?: string;
    finalUrl?: string;
    requests?: RoutedRequest[];
    sockets?: string[];
    gotoError?: Error;
    reachable?: boolean;
    onGoto?: () => void;
}

type Decide<T> = (request: T) => Promise<boolean>;

class Record {
    readonly calls: string[] = [];
    readonly verdicts: Array<[string, boolean]> = [];
    readonly sessions: SessionOptions[] = [];
}

class FakeTab implements BrowserTab {
    constructor(private readonly session: FakeSession) {}

    async goto(url: string): Promise<void> {
        this.session.record.calls.push(`goto ${url}`);
        await this.session.replay();
        this.session.script.onGoto?.();
        if (this.session.script.gotoError) throw this.session.script.gotoError;
    }

    async settle(): Promise<void> {
        this.session.record.calls.push("settle");
    }

    async content(): Promise<string> {
        return this.session.script.html ?? "<html><body><p>Rendered</p></body></html>";
    }

    url(): string {
        return this.session.script.finalUrl ?? "https://acme.example/careers";
    }
}

class FakeSession implements BrowserSession {
    private decide: Decide<RoutedRequest> | null = null;
    private decideSocket: Decide<string> | null = null;

    constructor(
        readonly script: FakeScript,
        readonly record: Record,
    ) {}

    async route(handler: Decide<RoutedRequest>): Promise<void> {
        this.record.calls.push("route");
        this.decide = handler;
    }

    async routeWebSockets(handler: Decide<string>): Promise<void> {
        this.record.calls.push("routeWebSockets");
        this.decideSocket = handler;
    }

    async open(): Promise<BrowserTab> {
        return new FakeTab(this);
    }

    async probe(url: string): Promise<boolean> {
        this.record.calls.push(`probe ${url}`);
        return this.script.reachable ?? false;
    }

    async close(): Promise<void> {
        this.record.calls.push("close session");
    }

    async replay(): Promise<void> {
        for (const request of this.script.requests ?? []) this.record.verdicts.push([request.url, (await this.decide?.(request)) ?? true]);
        for (const socket of this.script.sockets ?? []) this.record.verdicts.push([socket, (await this.decideSocket?.(socket)) ?? true]);
    }
}

export function fakeBrowser(script: FakeScript = {}) {
    const record = new Record();
    const port: BrowserPort = {
        session: async (options) => {
            record.sessions.push(options);
            return new FakeSession(script, record);
        },
        close: async () => void record.calls.push("close browser"),
    };
    return { port, calls: record.calls, verdicts: record.verdicts, sessions: record.sessions };
}
