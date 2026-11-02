import { expect, test } from "vitest";
import { rescoreStep } from "../src/rescore/plan.js";
import { testAppSettings } from "./helpers/config.js";

const CONFIG = testAppSettings({ exclude_companies: ["acme"], body_filter: { include: ["typescript"], exclude: ["clearance"] } });
const JOB = { title: "Software Engineer", company: "Initech", description: "TypeScript services.", description_format: "text" as const };
const BLANK = { ...JOB, description: null, description_format: null };
const NOT_YET = { lookedUp: false };

test("an excluded company is named first, even when its title and description would also hide it", () => {
    expect(rescoreStep({ ...JOB, company: "Acme", title: "Account Executive", description: "Clearance required." }, CONFIG, NOT_YET)).toEqual({ kind: "filtered", by: "company" });
});

test("a title-filtered job with no description is filtered, not looked up", () => {
    expect(rescoreStep({ ...BLANK, title: "Account Executive" }, CONFIG, NOT_YET)).toEqual({ kind: "filtered", by: "title" });
});

test("a description holding an excluded term, or none of the included ones, is filtered by the body filter", () => {
    expect([rescoreStep({ ...JOB, description: "TypeScript; clearance required." }, CONFIG, NOT_YET), rescoreStep({ ...JOB, description: "We write Java." }, CONFIG, NOT_YET)]).toEqual([
        { kind: "filtered", by: "body" },
        { kind: "filtered", by: "body" },
    ]);
});

test("a job with no description is looked up first", () => {
    expect(rescoreStep(BLANK, CONFIG, NOT_YET)).toEqual({ kind: "lookup" });
});

test("a job with no description is scored once its lookup is done", () => {
    expect([rescoreStep(BLANK, CONFIG, { lookedUp: true }), rescoreStep(JOB, CONFIG, NOT_YET)]).toEqual([{ kind: "score" }, { kind: "score" }]);
});
