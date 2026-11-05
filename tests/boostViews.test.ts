import { expect, test } from "vitest";
import { boostedScore, type Boost } from "../src/jobs/boosts.js";
import { boostDetail, boostText } from "../src/web/boostViews.js";

const TWO_PLACES: Boost = {
    points: 15,
    applied: [
        { term: "senior", where: "title", points: 5 },
        { term: "typescript", where: "description", points: 10 },
    ],
};

test("a boost names each term with its points and where it was found, after the total", () => {
    expect(boostText(TWO_PLACES)).toBe("+15 senior +5 (title), typescript +10 (description)");
    expect(boostDetail(TWO_PLACES)).toEqual({ total: 15, lines: ["senior +5 (title)", "typescript +10 (description)"] });
});

test("a term found in both places reads as found in the title and description", () => {
    expect(boostDetail({ points: 10, applied: [{ term: "react", where: "both", points: 10 }] })?.lines).toEqual(["react +10 (title and description)"]);
});

test("no boost gives no text and no detail", () => {
    const none: Boost = { points: 0, applied: [] };
    expect([boostText(none), boostDetail(none)]).toEqual([null, null]);
});

test("a capped score still lists every boost with its points", () => {
    expect([boostedScore(95, TWO_PLACES), boostDetail(TWO_PLACES)?.total, boostDetail(TWO_PLACES)?.lines.length]).toEqual([100, 15, 2]);
});
