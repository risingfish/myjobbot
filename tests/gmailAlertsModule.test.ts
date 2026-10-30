import { expect, test } from "vitest";
import { NotSetUp } from "../src/sources/failure.js";
import { gmailAlerts } from "../src/sources/modules/gmailAlerts.js";
import { moduleFor } from "../src/sources/registry.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { fetchRun } from "./helpers/tools.js";

test("the gmail_alerts module needs Gmail: a run skips it as not set up until Gmail can be read, and it never reads without Gmail", async () => {
    expect([moduleFor("gmail_alerts")?.requires, gmailAlerts.scope, gmailAlerts.target({})]).toEqual([["gmail"], "account", "gmail_alerts"]);
    const pages = gmailAlerts.fetch({}, { http: fakeBoard({}), sourceName: "Gmail alerts" }, null)[Symbol.asyncIterator]();
    await expect(pages.next()).rejects.toThrow(NotSetUp);
    const context = testContext({ http: fakeBoard({ jobs: [] }) });
    await fetchRun(context);
    expect(context.run.sources.get("Gmail alerts")).toEqual({ outcome: "skipped", reason: "not set up", seen: null });
});
