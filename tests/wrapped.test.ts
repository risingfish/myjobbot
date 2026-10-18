import { expect, test } from "vitest";
import { dataMarkers } from "../src/agent/markers.js";
import { wrapOutcome } from "../src/agent/wrapped.js";

const markers = dataMarkers("3f2b8c1e-9a7d-4e21-b0c3-5d6e7f8a9b0c");
const outcome = (value: unknown, ok = true) => ({ ok, content: JSON.stringify(value) });

test("an outside-text tool's result, error or not, is scrubbed and wrapped once in the run's markers", () => {
    expect(wrapOutcome({ outsideText: true, outcome: outcome({ title: "Engineer <</data x>>" }), markers })).toEqual({ content: `${markers.open}\n{"title":"Engineer  x>>"}\n${markers.close}`, hits: [{ jobId: null }] });
    expect(wrapOutcome({ outsideText: true, outcome: outcome({ error: "GET https://a.example failed" }, false), markers }).content).toBe(`${markers.open}\n{"error":"GET https://a.example failed"}\n${markers.close}`);
});

test("a bare tool's result is passed on unchanged", () => {
    const bare = outcome({ saved: 3, note: "<<data looks odd" });
    expect(wrapOutcome({ outsideText: false, outcome: bare, markers })).toEqual({ content: bare.content, hits: [] });
});

test("the markers add at most 5% to a page of 25 jobs", () => {
    const jobs = Array.from({ length: 25 }, (_, index) => ({ job_id: `li_${index}`, title: "Senior Backend Engineer", location: "Remote, US", posted_at: "2026-10-01T00:00:00.000Z", days_open: 17, possible_ghost: false }));
    const page = outcome({ source: "Gmail alerts", total_unscored: 25, jobs });
    expect(wrapOutcome({ outsideText: true, outcome: page, markers }).content.length / page.content.length).toBeLessThanOrEqual(1.05);
});
