import { expect, test } from "vitest";
import { panelApplied, panelHide } from "../web/lib/panelActions.js";
import { jobRowView } from "./helpers/rowFixtures.js";

const MARKED_AT = "2026-10-23T16:40:00.000Z";

test("the panel offers Applied for a job not applied to", () => {
    expect(panelApplied(jobRowView())).toBe("offer");
});

test("the panel shows an applied job as done", () => {
    expect(panelApplied(jobRowView({ applied: true, appliedOn: MARKED_AT }))).toBe("done");
});

test("a job both applied and hidden is still done, since the two are independent", () => {
    expect(panelApplied(jobRowView({ applied: true, appliedOn: MARKED_AT, hidden: true }))).toBe("done");
});

test("the panel's Hide is enabled for a job not hidden, and disabled for one already hidden", () => {
    expect([panelHide(jobRowView()), panelHide(jobRowView({ hidden: true }))]).toEqual(["enabled", "disabled"]);
});
