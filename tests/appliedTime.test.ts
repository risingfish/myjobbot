import { expect, test } from "vitest";
import { appliedFact, rowLabel } from "../web/lib/appliedTime.js";
import { jobRowView } from "./helpers/rowFixtures.js";

const LATE_EVENING_IN_LOS_ANGELES = "2026-10-23T23:30:00.000Z";
const applied = jobRowView({ applied: true, appliedOn: LATE_EVENING_IN_LOS_ANGELES });

test("a job not applied to is labelled as one to mark", () => {
    expect(rowLabel(jobRowView(), "America/Los_Angeles")).toBe("Mark as applied");
});

test("an applied job is labelled with the date it was marked, in the browser's zone", () => {
    expect(rowLabel(applied, "America/Los_Angeles")).toBe("Applied on 2026-10-23");
});

test("the same moment falls on a later date further east", () => {
    expect(rowLabel(applied, "Asia/Tokyo")).toBe("Applied on 2026-10-24");
});

test("before the browser's zone is known, an applied job's label leaves out the date", () => {
    expect(rowLabel(applied, null)).toBe("Applied");
});

test("before the browser's zone is known, a job not applied to is still one to mark", () => {
    expect(rowLabel(jobRowView(), null)).toBe("Mark as applied");
});

test("the panel's Job section gives the date and time an applied job was marked, in the browser's zone", () => {
    expect(appliedFact(jobRowView({ applied: true, appliedOn: "2026-10-23T16:40:00.000Z" }), "America/Los_Angeles")).toBe("2026-10-23 09:40");
});

test("the panel's Job section says when a job is not applied to", () => {
    expect(appliedFact(jobRowView(), "America/Los_Angeles")).toBe("Not applied");
});

test("before the browser's zone is known, the panel's Job section only says an applied job is applied", () => {
    expect(appliedFact(applied, null)).toBe("Yes");
});
