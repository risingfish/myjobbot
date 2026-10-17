import { expect, test } from "vitest";
import type { BrowserPort } from "../src/careers/browser.js";
import { PageRenderer } from "../src/careers/renderState.js";
import { testFileConfig } from "./helpers/config.js";
import { TEST_NOW } from "./helpers/context.js";
import { fakeBrowser } from "./helpers/fakeBrowser.js";
import { publicDns } from "./helpers/fakeDns.js";
import { MemoryCareersStore } from "./helpers/memoryCareersStore.js";
import { memoryTrace } from "./helpers/trace.js";

const PAGE = "https://acme.example/careers";

function renderer(connect: (() => Promise<BrowserPort>) | null, probe?: string) {
    const careers = new MemoryCareersStore();
    const trace = memoryTrace();
    const settings = testFileConfig({ careers_lookup: probe === undefined ? {} : { lan_probe_url: probe } }).careers_lookup;
    return { careers, trace, renderer: new PageRenderer({ connect, settings, lookup: publicDns(), careers, trace, runId: "run-1", now: () => TEST_NOW }) };
}

test("with no browser service, nothing is rendered and the note says rendering is not configured", async () => {
    const { renderer: off } = renderer(null);
    expect(off.notes()).toEqual([]);
    expect(await off.render(PAGE)).toEqual({ fallback: "render_off" });
    expect(off.notes()).toEqual(["page rendering not configured"]);
});

test("a browser that can't be reached turns rendering off for the rest of the run, connecting only once", async () => {
    let connects = 0;
    const { renderer: failing } = renderer(() => ((connects += 1), Promise.reject(new Error("ECONNREFUSED"))));
    expect(await failing.render(PAGE)).toEqual({ fallback: "render_failed" });
    expect(await failing.render(PAGE)).toEqual({ fallback: "render_off" });
    expect([connects, failing.notes()]).toEqual([1, ["page rendering turned off: browser service failed"]]);
});

test("the first rendering checks once whether the browser can reach the LAN, warning without blocking when it can", async () => {
    const browser = fakeBrowser({ reachable: true });
    const { renderer: checked, careers, trace } = renderer(async () => browser.port, "http://192.168.3.1/");
    expect(await checked.render(PAGE)).toMatchObject({ page: { url: PAGE } });
    await checked.render(PAGE);
    expect(browser.calls.filter((call) => call.startsWith("probe"))).toEqual(["probe http://192.168.3.1/"]);
    expect(careers.rows).toEqual([expect.objectContaining({ step: "render_check", url: "http://192.168.3.1/", outcome: "failed", warning: true, jobId: "" })]);
    expect(trace.events).toContainEqual({ type: "render_check", url: "http://192.168.3.1/", warning: true });
});

test("a browser kept off the LAN passes the check, and with no probe address the note says the LAN wasn't checked", async () => {
    const { renderer: kept, careers } = renderer(async () => fakeBrowser({ reachable: false }).port, "http://192.168.3.1/");
    await kept.render(PAGE);
    expect(careers.rows).toEqual([expect.objectContaining({ step: "render_check", outcome: "ok", warning: false })]);
    const { renderer: unchecked } = renderer(async () => fakeBrowser().port);
    await unchecked.render(PAGE);
    expect(unchecked.notes()).toEqual(["LAN check not configured"]);
});

test("closing the renderer closes the browser connection it opened", async () => {
    const browser = fakeBrowser();
    const { renderer: open } = renderer(async () => browser.port);
    await open.close();
    expect(browser.calls).toEqual([]);
    await open.render(PAGE);
    await open.close();
    expect(browser.calls.at(-1)).toBe("close browser");
});
