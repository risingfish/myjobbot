import { Gauge, Registry } from "prom-client";
import { METRICS, type MetricValue } from "./definitions.js";

/** Builds the Prometheus exposition text for one scrape: every metric as a gauge, each value set under its labels; a value naming a label its metric doesn't declare is refused. */
export async function metricsText(values: MetricValue[]): Promise<string> {
    const registry = new Registry();
    const gauges = new Map(METRICS.map((metric) => [metric.name, new Gauge({ name: metric.name, help: metric.help, labelNames: metric.labelNames, registers: [registry] })]));
    for (const value of values) {
        const gauge = gauges.get(value.name);
        if (gauge === undefined) throw new Error(`unknown metric ${value.name}`);
        gauge.set(value.labels, value.value);
    }
    return registry.metrics();
}

export const METRICS_CONTENT_TYPE = new Registry().contentType;
