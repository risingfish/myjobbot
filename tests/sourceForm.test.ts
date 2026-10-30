import { expect, test } from "vitest";
import { recognizeLink } from "../src/sources/registry.js";
import { sourceChoices } from "../src/web/sourceChoices.js";
import { sourceFormView } from "../src/web/sourceForm.js";
import { WORKDAY_PARAMS } from "./helpers/workdaySite.js";

const MET = { jsearch_key: true, gmail: true };

test("a link to each job board, or to one of its postings, gives its source type, fields and a name to offer", () => {
    const links = ["https://boards.greenhouse.io/stripe", "job-boards.greenhouse.io/affirm/jobs/7815948003", "https://jobs.lever.co/palantir/abc-123", "https://jobs.ashbyhq.com/openai", "https://acme.wd5.myworkdayjobs.com/en-US/Acme_Careers/job/Remote/SBE_R1"];
    expect(links.map(recognizeLink)).toEqual([
        { module: "greenhouse", params: { slug: "stripe" }, name: "Stripe" },
        { module: "greenhouse", params: { slug: "affirm" }, name: "Affirm" },
        { module: "lever", params: { slug: "palantir" }, name: "Palantir" },
        { module: "ashby", params: { slug: "openai" }, name: "Openai" },
        { module: "workday", params: WORKDAY_PARAMS, name: "Acme" },
    ]);
});

test("a link no source type recognises gives nothing", () => {
    expect(["https://example.com/careers", "not a link at all", ""].map(recognizeLink)).toEqual([null, null, null]);
});

test("the source types the owner can add are plain data: id, name, description, fields and availability", () => {
    const choices = sourceChoices(MET);
    expect(choices.map((choice) => choice.id)).toEqual(["greenhouse", "lever", "ashby", "workday", "jsearch"]);
    expect(JSON.parse(JSON.stringify(choices))).toEqual(choices);
    expect(choices[0]).toEqual({ id: "greenhouse", name: "Greenhouse", description: expect.any(String), fields: [{ name: "slug", label: "Board id", input: "text" }], unavailable: null });
});

test("a form lists its module's fields with their values, each with its problems, and the rest at the top", () => {
    const [jsearch] = sourceChoices(MET).filter((choice) => choice.id === "jsearch");
    if (jsearch === undefined) throw new Error("no JSearch choice");
    const draft = { id: null, module: "jsearch", name: "Go", values: { query: "go", remote_only: true } };
    const problems = [
        { field: "name", entry: null, message: "a source with this name already exists" },
        { field: "query", entry: null, message: "Too small" },
        { field: null, entry: null, message: "too many searches" },
    ];
    const view = sourceFormView(jsearch, draft, problems);
    expect(view.name).toEqual({ value: "Go", problems: ["a source with this name already exists"] });
    expect(view.fields.map((shown) => [shown.field.name, shown.value, shown.problems])).toEqual([
        ["query", "go", ["Too small"]],
        ["country", "", []],
        ["remote_only", true, []],
    ]);
    expect(view.top).toEqual(["too many searches"]);
});

test("a source type whose needs aren't set up says why it can't be used", () => {
    const jsearch = sourceChoices({ ...MET, jsearch_key: false }).find((choice) => choice.id === "jsearch");
    expect(jsearch?.unavailable).toBe("Needs JSEARCH_API_KEY in .env");
});
