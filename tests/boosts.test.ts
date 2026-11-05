import { expect, test } from "vitest";
import { appliedBoosts, boostedScore, boostLists, maxBoost } from "../src/jobs/boosts.js";
import type { DescriptionFormat } from "../src/jobs/job.js";

function job(title: string, description: string | null = null, format: DescriptionFormat = "text") {
    return { title, description, description_format: description === null ? null : format };
}

function lists(title: Record<string, number> = {}, description: Record<string, number> = {}) {
    return { title, description };
}

test("a description boost adds its points once, however often the description says it", () => {
    const boost = appliedBoosts(job("Engineer", "TypeScript, TypeScript and more TypeScript. We love TypeScript."), lists({}, { typescript: 10 }));
    expect(boost).toEqual({ points: 10, applied: [{ term: "typescript", where: "description", points: 10 }] });
});

test("a description boost never matches the title", () => {
    expect(appliedBoosts(job("TypeScript Developer", "We build web apps."), lists({}, { typescript: 10 })).points).toBe(0);
});

test("a job with no description matches no description boost", () => {
    expect(appliedBoosts(job("TypeScript Developer"), lists({}, { typescript: 10 }))).toEqual({ points: 0, applied: [] });
});

test("a Markdown link's words can match a description boost, its address never", () => {
    const boost = appliedBoosts(job("Engineer", "Read our [TypeScript guide](https://example.com/react)", "markdown"), lists({}, { react: 5, typescript: 3 }));
    expect(boost.applied.map((applied) => applied.term)).toEqual(["typescript"]);
});

test("the lists come from the two boost settings", () => {
    expect(boostLists({ title_boosts: { senior: 5 }, description_boosts: { go: 3 } })).toEqual({ title: { senior: 5 }, description: { go: 3 } });
});

test("a title boost adds its points when the title has the term", () => {
    expect(appliedBoosts(job("Senior Software Engineer"), lists({ senior: 5 }))).toEqual({ points: 5, applied: [{ term: "senior", where: "title", points: 5 }] });
});

test("a title boost never matches the description", () => {
    expect(appliedBoosts(job("Software Engineer", "You will work with senior engineers."), lists({ senior: 5 })).points).toBe(0);
});

test("boosts match whole words only", () => {
    expect(appliedBoosts(job("Nodejs Engineer"), lists({ node: 5 })).points).toBe(0);
    expect(appliedBoosts(job("Vuetify Developer"), lists({ vue: 8 })).points).toBe(0);
    expect(appliedBoosts(job("Node Engineer"), lists({ node: 5 })).points).toBe(5);
});

test("a term in both lists found in both places counts once, at the higher value", () => {
    const both = appliedBoosts(job("React Developer", "We use React."), lists({ react: 5 }, { react: 10 }));
    expect(both).toEqual({ points: 10, applied: [{ term: "react", where: "both", points: 10 }] });
    expect(appliedBoosts(job("React Developer", "We use React."), lists({ react: 10 }, { react: 5 })).points).toBe(10);
});

test("a term in both lists found in one place gets that list's points", () => {
    expect(appliedBoosts(job("React Developer", "We build apps."), lists({ react: 5 }, { react: 10 })).applied).toEqual([{ term: "react", where: "title", points: 5 }]);
    expect(appliedBoosts(job("Developer", "We use React."), lists({ react: 5 }, { react: 10 })).applied).toEqual([{ term: "react", where: "description", points: 10 }]);
});

test("terms that differ only in case are one term, across the lists and within one", () => {
    expect(appliedBoosts(job("React Developer", "We use React."), lists({ React: 5 }, { react: 10 })).applied).toEqual([{ term: "React", where: "both", points: 10 }]);
    expect(appliedBoosts(job("React Developer"), lists({ React: 5, react: 8 }))).toEqual({ points: 8, applied: [{ term: "react", where: "title", points: 8 }] });
});

test("applied boosts list the title list's terms first, then the rest of the description list", () => {
    const boost = appliedBoosts(job("Senior Engineer", "TypeScript and Go."), lists({ senior: 5, go: 2 }, { typescript: 10, go: 3 }));
    expect(boost.applied.map((applied) => [applied.term, applied.where, applied.points])).toEqual([
        ["senior", "title", 5],
        ["go", "description", 3],
        ["typescript", "description", 10],
    ]);
});

test("a boosted score never exceeds 100", () => {
    expect(boostedScore(95, { points: 15, applied: [] })).toBe(100);
    expect(boostedScore(60, { points: 15, applied: [] })).toBe(75);
});

test("max boost takes each term once, at its highest value in either list", () => {
    expect(maxBoost(lists({ react: 5, senior: 5 }, { react: 10, go: 3 }))).toBe(18);
});

test("max boost is never below the boost a job really gets, repeats within a list included", () => {
    const repeated = lists({ React: 5, react: 8 });
    expect(maxBoost(repeated)).toBe(8);
    expect(maxBoost(repeated)).toBeGreaterThanOrEqual(appliedBoosts(job("React Developer"), repeated).points);
});

test("max boost with no boosts is 0", () => {
    expect(maxBoost(lists())).toBe(0);
});
