import { expect, test } from "vitest";
import { METRICS } from "../src/metrics/definitions.js";
import { metricsText } from "../src/metrics/registry.js";

test("the exposition text holds every metric, typed as a gauge, with only its own labels", async () => {
    const text = await metricsText([{ name: "myjobbot_source_fetches", labels: { module: "greenhouse", outcome: "ok", window: "24h" }, value: 3 }, { name: "myjobbot_last_run_ok", labels: {}, value: 1 }]);
    for (const metric of METRICS) expect(text).toContain(`# TYPE ${metric.name} gauge`);
    expect(text).toContain('myjobbot_source_fetches{module="greenhouse",outcome="ok",window="24h"} 3');
    expect(text).toContain("myjobbot_last_run_ok 1");
});

test("a value whose labels a metric doesn't declare is refused rather than exposed", async () => {
    await expect(metricsText([{ name: "myjobbot_last_run_ok", labels: { source: "Secret Source Name" }, value: 1 }])).rejects.toThrow();
});
