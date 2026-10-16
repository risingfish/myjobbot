import { htmlText } from "./html.js";

type AlertLayout = "linkedin_search" | "linkedin_digest";

export interface AlertEmail {
    uid: number;
    from: string;
    subject: string;
    html: string;
}

export interface AlertJob {
    linkedinId: string;
    title: string;
    company: string;
    location: string | null;
    salary: string | null;
}

export interface ParsedAlert {
    layout: AlertLayout | null;
    keywords: string | null;
    jobs: AlertJob[];
}

const NOTHING: ParsedAlert = { layout: null, keywords: null, jobs: [] };
const JOB_LINK = /<a\b[^>]*href="[^"]*\/jobs\/view\/([^/?"]*)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
const DETAIL = /<p\b[^>]*class="[^"]*text-system-gray-100[^"]*"[^>]*>([\s\S]*?)<\/p>/g;
const SEARCH_LINK = /href="([^"]*\/jobs\/search-results\/[^"]*)"/;
const MONEY = /\$\s?\d[\d,.]*\s?[kKmM]?(?:\s?\/\s?(?:yr|year|hr|hour))?/;

/** Reads a LinkedIn job-alert email's HTML into its jobs, or reports no layout for anything else. */
export function parseAlert(email: AlertEmail): ParsedAlert {
    if (!email.from.toLowerCase().endsWith("@linkedin.com")) return NOTHING;
    const jobs = jobsIn(email.html);
    if (jobs.length === 0) return NOTHING;
    const keywords = searchKeywords(email.html);
    return { layout: keywords === null ? "linkedin_digest" : "linkedin_search", keywords, jobs };
}

/** Collects each titled job link once, with the company, location and salary that follow it. */
function jobsIn(html: string): AlertJob[] {
    const titled = [...html.matchAll(JOB_LINK)].filter((match) => htmlText(match[2] ?? "") !== "");
    const seen = new Set<string>();
    return titled.flatMap((match, index) => {
        const id = /^\d+$/.test(match[1] ?? "") ? (match[1] ?? "") : "";
        if (id === "" || seen.has(id)) return [];
        seen.add(id);
        const end = titled[index + 1]?.index ?? html.length;
        return [toJob(id, htmlText(match[2] ?? ""), html.slice((match.index ?? 0) + match[0].length, end))];
    });
}

/** Builds one alert job from its title and the detail paragraphs between it and the next job. */
function toJob(linkedinId: string, title: string, following: string): AlertJob {
    const details = [...following.matchAll(DETAIL)].map((match) => htmlText(match[1] ?? ""));
    const [company = "", location = null] = (details[0] ?? "").split(" · ").map((part) => part.trim());
    const salary = details.slice(1).find((line) => MONEY.test(line)) ?? null;
    return { linkedinId, title, company, location: location || null, salary };
}

/** Returns the saved search's keywords from the alert's "see all results" link, or null for a digest. */
function searchKeywords(html: string): string | null {
    const href = SEARCH_LINK.exec(html)?.[1];
    if (href === undefined) return null;
    return new URL(htmlText(href)).searchParams.get("keywords");
}
