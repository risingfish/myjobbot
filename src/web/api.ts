export type PageName = "recommended" | "jobs" | "reasoning";

export const PAGE_NAMES: readonly PageName[] = ["recommended", "jobs", "reasoning"];

export const PAGES = [
  { path: "/recommended", label: "Recommended" },
  { path: "/jobs", label: "All jobs" },
  { path: "/reasoning", label: "Reasoning" },
  { path: "/settings", label: "Settings" },
] as const;

export interface Score {
  value: number;
  note: string;
}

export interface JobRowView {
  ats: string;
  jobId: string;
  title: string;
  url: string | null;
  company: string;
  location: string;
  remote: "yes" | "no" | "";
  source: string;
  via: string | null;
  posted: { date: string; daysOpen: number; ghost: boolean };
  scoredDate: string;
  score: Score | null;
  filterNote: string | null;
  hidden: boolean;
  reasons: string[];
  gaps: string[];
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

export interface Meta {
  dbPath: string;
  renderedAt: string;
}
