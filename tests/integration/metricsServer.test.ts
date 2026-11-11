import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, test } from "vitest";
import { metricsHandler } from "../../src/metrics/server.js";
import { renderMetrics } from "../../src/metrics/read.js";
import { memoryStores } from "../helpers/memoryStore.js";

const TOKEN = "m".repeat(40);
let server: Server;
let base: string;

beforeAll(async () => {
    const stores = memoryStores();
    await stores.mailLog.record({ at: new Date().toISOString(), kind: "test", outcome: "sent", reason: null });
    server = createServer(metricsHandler({ token: TOKEN, render: () => renderMetrics(stores, 190, new Date()) }));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

test("the metrics are served only to a request with the token, at /metrics only, and nothing else is said", async () => {
    const scraped = await fetch(`${base}/metrics`, { headers: { authorization: `Bearer ${TOKEN}` } });
    expect([scraped.status, scraped.headers.get("content-type")?.startsWith("text/plain")]).toEqual([200, true]);
    expect(await scraped.text()).toContain('myjobbot_mail_sends{kind="test",outcome="sent",window="24h"} 1');
    const refused = await fetch(`${base}/metrics`, { headers: { authorization: "Bearer wrong" } });
    const other = await fetch(`${base}/other`, { headers: { authorization: `Bearer ${TOKEN}` } });
    expect([refused.status, await refused.text(), other.status, await other.text()]).toEqual([401, "", 404, ""]);
});
