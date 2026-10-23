import { expect, test } from "vitest";
import { saveOutcome } from "../web/lib/saveOutcome.js";

test("a successful result is the saved result", () => {
    const result = { ok: true as const, appliedOn: "2026-10-23T16:40:00.000Z" };
    expect(saveOutcome(result)).toBe(result);
});

test("a refused result is a failure", () => {
    expect(saveOutcome({ ok: false as const, error: "No such job." })).toBeNull();
});

test("a send that rejected is a failure", () => {
    expect(saveOutcome(null)).toBeNull();
});
