import type { JobRowView, PageData, VerdictRowView } from "../../src/web/api.js";

const BASE_JOB_ROW: JobRowView = {
    ats: "greenhouse",
    jobId: "a",
    title: "Software Engineer a",
    url: "https://example.com/a",
    company: "Acme",
    location: "Remote",
    remote: "yes",
    source: "Stripe",
    via: null,
    posted: { date: "2026-09-30", daysOpen: 3, ghost: false },
    scoredDate: "2026-10-02",
    score: { value: 90, note: "" },
    filterNote: null,
    hidden: false,
    reasons: ["reason a"],
    gaps: ["gap a"],
};

export function jobRowView(overrides: Partial<JobRowView> = {}): JobRowView {
    return { ...BASE_JOB_ROW, ...overrides };
}

export function verdictRowView(overrides: Partial<VerdictRowView> = {}): VerdictRowView {
    return {
        key: "1",
        scoredAt: "2026-10-02 00:00",
        run: "run-1",
        title: "Software Engineer a",
        url: "https://example.com/a",
        company: "Acme",
        score: { value: 80, note: "" },
        reasons: ["reason a"],
        gaps: ["gap a"],
        ...overrides,
    };
}

type PageText = Partial<Pick<PageData, "total" | "nextOffset" | "summary" | "empty">>;

export function jobPage(rows: JobRowView[], overrides: PageText = {}): PageData {
    const text = { summary: `${rows.length} jobs`, empty: "No jobs retrieved yet: run myjobbot run." };
    return { kind: "jobs", rows, total: rows.length, nextOffset: null, ...text, ...overrides };
}

export function verdictPage(rows: VerdictRowView[]): PageData {
    const text = { summary: `${rows.length} scoring decisions`, empty: "No jobs scored yet: run myjobbot run." };
    return { kind: "verdicts", rows, total: rows.length, nextOffset: null, ...text };
}
