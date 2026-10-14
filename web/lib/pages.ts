import type { PageName } from "../../src/web/api.js";

export const PAGE_NAMES = ["recommended", "jobs", "reasoning"] as const satisfies readonly PageName[];

export const PAGES = [
  { path: "/recommended", label: "Recommended" },
  { path: "/jobs", label: "All jobs" },
  { path: "/reasoning", label: "Reasoning" },
  { path: "/settings", label: "Settings" },
] as const;
