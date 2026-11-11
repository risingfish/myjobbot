import type { PageName } from "../../src/web/api.js";

export const PAGE_NAMES = ["recommended", "applied", "jobs", "reasoning"] as const satisfies readonly PageName[];

export const PAGES = [
    { path: "/recommended", label: "Recommended" },
    { path: "/applied", label: "Applied" },
    { path: "/jobs", label: "All jobs" },
    { path: "/reasoning", label: "Reasoning" },
    { path: "/settings", label: "Settings" },
    { path: "/account", label: "Account" },
    { path: "/monitoring", label: "Monitoring", admin: true },
] as const;
