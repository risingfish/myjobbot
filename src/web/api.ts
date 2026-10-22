export type PageName = "recommended" | "jobs" | "reasoning";

export interface Score {
    value: number;
    note: string;
}

export interface JobRowView {
    ats: string;
    jobId: string;
    title: string;
    shortTitle: string;
    url: string | null;
    company: string;
    location: string;
    remote: "yes" | "no" | "";
    source: string;
    via: string | null;
    posted: { date: string; daysOpen: number; ghost: boolean };
    score: Score | null;
    filterNote: string | null;
    injection: boolean;
    hidden: boolean;
    reasons: string[];
    gaps: string[];
}

export interface ScoreDetail {
    total: number;
    model: number;
    boost: string | null;
    base: number | null;
    bonus: number | null;
    reasons: string[];
    gaps: string[];
    scoredAt: string | null;
}

export type DescriptionOrigin = { kind: "source" } | { kind: "careers"; url: string | null };

export interface DescriptionDetail {
    text: string | null;
    requirements: string[];
    skills: string[];
    preferredSkills: string[];
    origin: DescriptionOrigin | null;
}

export interface HistoryEntry {
    scoredAt: string;
    total: number;
    base: number | null;
    bonus: number | null;
    run: string | null;
}

export interface JobDetailView {
    job: JobRowView & { pay: string | null; workplace: string | null };
    score: ScoreDetail | null;
    description: DescriptionDetail;
    warnings: string[];
    history: HistoryEntry[];
}

export interface VerdictRowView {
    key: string;
    scoredAt: string;
    run: string | null;
    title: string;
    url: string | null;
    company: string;
    score: Score;
    reasons: string[];
    gaps: string[];
}

interface PageText {
    total: number;
    nextOffset: number | null;
    summary: string;
    empty: string;
}

export type PageData = PageText & ({ kind: "jobs"; rows: JobRowView[] } | { kind: "verdicts"; rows: VerdictRowView[] });
