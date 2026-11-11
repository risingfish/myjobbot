import { expect, test, vi } from "vitest";
import { metricsCommand } from "../src/metrics/command.js";
import { metricsToken, tokenOk } from "../src/metrics/token.js";

const TOKEN = "t".repeat(40);

test("only the exact token, sent as a bearer token, lets a scrape in", () => {
    expect(tokenOk(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect([tokenOk(`Bearer ${TOKEN}x`, TOKEN), tokenOk(`Bearer ${"u".repeat(40)}`, TOKEN), tokenOk(undefined, TOKEN), tokenOk(`Basic ${TOKEN}`, TOKEN), tokenOk(TOKEN, TOKEN)]).toEqual([false, false, false, false, false]);
});

test("the metrics token must be set and at least 32 characters", () => {
    expect([metricsToken({ MYJOBBOT_METRICS_TOKEN: TOKEN }), metricsToken({ MYJOBBOT_METRICS_TOKEN: "short" }), metricsToken({})]).toEqual([TOKEN, null, null]);
});

test("the metrics process refuses to start without a valid token, before opening anything", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await metricsCommand({ MYJOBBOT_METRICS_TOKEN: "short" })).toBe(1);
    expect(errors.mock.calls[0]?.[0]).toContain("MYJOBBOT_METRICS_TOKEN");
});
