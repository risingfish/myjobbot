import { expect, test } from "vitest";
import { checkBrowserLan } from "../src/careers/lanCheck.js";
import { testAppSettings } from "./helpers/config.js";
import { TEST_NOW } from "./helpers/context.js";
import { fakeBrowser } from "./helpers/fakeBrowser.js";
import { MemoryCareersStore } from "./helpers/memoryCareersStore.js";
import { memoryTrace } from "./helpers/trace.js";

test("the LAN check says it wasn't configured when there is no probe address, and otherwise probes, records and gives no note", async () => {
    const check = (probe?: string) => {
        const careers = new MemoryCareersStore();
        const settings = testAppSettings({ careers_lookup: probe === undefined ? {} : { lan_probe_url: probe } }).careers_lookup;
        return { careers, run: checkBrowserLan({ settings, careers, trace: memoryTrace(), runId: "run-1", now: () => TEST_NOW }) };
    };
    const unconfigured = check();
    const configured = check("http://192.168.0.1/");
    expect([await unconfigured.run(fakeBrowser().port), await configured.run(fakeBrowser({ reachable: false }).port)]).toEqual(["LAN check not configured", null]);
    expect([unconfigured.careers.rows, configured.careers.rows.map((row) => [row.step, row.outcome])]).toEqual([[], [["render_check", "ok"]]]);
});
