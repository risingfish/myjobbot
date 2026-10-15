import ashby from "../fixtures/ashby.json" with { type: "json" };
import greenhouse from "../fixtures/greenhouse.json" with { type: "json" };
import jsearch from "../fixtures/jsearch.json" with { type: "json" };
import lever from "../fixtures/lever.json" with { type: "json" };

const FIXTURES = { "ashby.json": ashby, "greenhouse.json": greenhouse, "jsearch.json": jsearch, "lever.json": lever };

export function loadFixture(name: keyof typeof FIXTURES): unknown {
    return structuredClone(FIXTURES[name]);
}
