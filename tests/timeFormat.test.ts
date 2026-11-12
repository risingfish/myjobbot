import { expect, test } from "vitest";
import { dayIn, minuteIn } from "../src/time/format.js";
import { minutes, utcMinutes } from "../src/time/minutes.js";

const LATE_EVENING_IN_LOS_ANGELES = "2026-10-23T23:30:00.000Z";

test("a stored time is shown to the minute in the zone asked for", () => {
    expect([minuteIn(LATE_EVENING_IN_LOS_ANGELES, "utc"), minuteIn(LATE_EVENING_IN_LOS_ANGELES, "America/Los_Angeles"), minuteIn(LATE_EVENING_IN_LOS_ANGELES, "Asia/Tokyo")]).toEqual(["2026-10-23 23:30", "2026-10-23 16:30", "2026-10-24 08:30"]);
});

test("a stored time falls on the date of the zone asked for", () => {
    expect([dayIn(LATE_EVENING_IN_LOS_ANGELES, "America/Los_Angeles"), dayIn(LATE_EVENING_IN_LOS_ANGELES, "Asia/Tokyo")]).toEqual(["2026-10-23", "2026-10-24"]);
});

test("a zone's clock change is followed: the same UTC hour is an hour apart in Los Angeles either side of it", () => {
    expect([minuteIn("2026-10-31T19:00:00.000Z", "America/Los_Angeles"), minuteIn("2026-11-02T19:00:00.000Z", "America/Los_Angeles")]).toEqual(["2026-10-31 12:00", "2026-11-02 11:00"]);
});

test("minutes shows a stored time in UTC, and utcMinutes says so", () => {
    expect([minutes("2026-11-12T03:04:59.999Z"), utcMinutes("2026-11-12T03:04:59.999Z")]).toEqual(["2026-11-12 03:04", "2026-11-12 03:04 UTC"]);
});
