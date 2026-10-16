import { expect, test } from "vitest";
import { lookupAllowance } from "../src/gmail/alertJobs/budget.js";

test("lookups may use what's left after saved searches' refreshes for the rest of the month", () => {
    const now = new Date("2026-10-31T00:00:00.000Z");
    expect(lookupAllowance({ cap: 190, usedThisMonth: 100, searches: 2, refreshHours: 8, now })).toBe(190 - 100 - 2 * Math.ceil(24 / 7.75));
    expect(lookupAllowance({ cap: 190, usedThisMonth: 185, searches: 2, refreshHours: 8, now })).toBe(0);
});

test("with no saved searches nothing is reserved, and in the month's last hour each search keeps one request", () => {
    const lastHour = new Date("2026-10-31T23:30:00.000Z");
    expect(lookupAllowance({ cap: 190, usedThisMonth: 10, searches: 0, refreshHours: 24, now: lastHour })).toBe(180);
    expect(lookupAllowance({ cap: 190, usedThisMonth: 10, searches: 3, refreshHours: 24, now: lastHour })).toBe(177);
});
