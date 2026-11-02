type BoardKind = "ashby" | "gem" | "greenhouse" | "lever" | "workday";

export interface BoardLink {
    kind: BoardKind;
    slug: string;
    postingId: string | null;
    host?: string;
    site?: string;
}

const WEB_PROTOCOLS = new Set(["http:", "https:"]);
export const WORKDAY_HOST = /^([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com$/;
const LOCALE = /^[a-z]{2}-[A-Z]{2}$/;
const HOST_LINKS = new Map<string, (parts: string[]) => BoardLink | null>([
    ["jobs.ashbyhq.com", (parts) => slugAndId("ashby", parts)],
    ["jobs.lever.co", (parts) => slugAndId("lever", parts)],
    ["jobs.gem.com", (parts) => slugAndId("gem", parts)],
    ["api.gem.com", gemApiLink],
    ["boards.greenhouse.io", greenhouseLink],
    ["job-boards.greenhouse.io", greenhouseLink],
]);

/** Recognises an address on a job board that publishes its postings as data, naming the board and any posting. */
export function parseBoardLink(address: string): BoardLink | null {
    if (!URL.canParse(address)) return null;
    const url = new URL(address);
    if (!WEB_PROTOCOLS.has(url.protocol) || url.port !== "") return null;
    const parts = url.pathname
        .split("/")
        .filter((part) => part !== "")
        .map(decodeURIComponent);
    const workday = WORKDAY_HOST.exec(url.hostname);
    if (workday?.[1] !== undefined) return workdayLink(url.hostname, workday[1], parts);
    return HOST_LINKS.get(url.hostname)?.(parts) ?? null;
}

/** Reads a board address shaped /<slug>[/<posting>]. */
function slugAndId(kind: BoardKind, parts: string[]): BoardLink | null {
    const [slug, postingId = null] = parts;
    if (slug === undefined || parts.length > 2) return null;
    return { kind, slug, postingId };
}

/** Reads a Gem job board data address shaped /job_board/v0/<slug>[/...], naming the board only. */
function gemApiLink([api, version, slug]: string[]): BoardLink | null {
    return api === "job_board" && version === "v0" && slug !== undefined ? { kind: "gem", slug, postingId: null } : null;
}

/** Reads a Greenhouse address shaped /<slug>[/jobs/<id>], leaving out its embed pages. */
function greenhouseLink(parts: string[]): BoardLink | null {
    const [slug, jobs, postingId] = parts;
    if (slug === undefined || slug === "embed") return null;
    if (parts.length === 1) return { kind: "greenhouse", slug, postingId: null };
    return jobs === "jobs" && postingId !== undefined && parts.length === 3 ? { kind: "greenhouse", slug, postingId } : null;
}

/** Reads a Workday address shaped [/<locale>]/<site>[/job/...], keeping the job path Workday's data uses. */
function workdayLink(host: string, tenant: string, parts: string[]): BoardLink | null {
    const rest = LOCALE.test(parts[0] ?? "") ? parts.slice(1) : parts;
    const [site, marker] = rest;
    if (site === undefined) return null;
    const postingId = marker === "job" && rest.length > 2 ? `/${rest.slice(1).join("/")}` : null;
    return { kind: "workday", slug: tenant, postingId, host, site };
}
