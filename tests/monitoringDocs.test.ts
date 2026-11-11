import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { METRICS } from "../src/metrics/definitions.js";

const doc = readFileSync("docs/monitoring.md", "utf8");

function documented(): Array<[string, string[]]> {
    return [...doc.matchAll(/^\| `(myjobbot_[a-z_]+)` \| ([^|]*)\|/gm)].map((match) => [match[1] ?? "", [...(match[2] ?? "").matchAll(/`([a-z_]+)`/g)].map((label) => label[1] ?? "")]);
}

test("docs/monitoring.md lists every metric emitted, with exactly its labels, and none that isn't", () => {
    expect(documented()).toEqual(METRICS.map((metric) => [metric.name, metric.labelNames]));
});
