import { expect, test } from "vitest";
import { daysOpenTone } from "../src/web/daysOpenTone.js";
import { toneClass, toneFor } from "../src/web/tones.js";

test("days open: the day it was seen is good, the next two fair, up to five a warning, older bad", () => {
    expect([0, 1, 2, 3, 5, 6, 40].map(daysOpenTone)).toEqual(["good", "fair", "fair", "warn", "warn", "bad", "bad"]);
});

test("any scale picks the first band a value doesn't pass, in rising order, else the tone beyond them", () => {
    const bands = [
        { upTo: 10, tone: "bad" as const },
        { upTo: 50, tone: "warn" as const },
    ];
    expect([toneFor(-1, bands, "good"), toneFor(10, bands, "good"), toneFor(10.5, bands, "good"), toneFor(51, bands, "good")]).toEqual(["bad", "bad", "warn", "good"]);
});

test("each tone is coloured by its own class", () => {
    expect(toneClass("warn")).toBe("tone-warn");
});
