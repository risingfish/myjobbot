import type { AlertEmail } from "../../src/gmail/alertJobs/parse.js";

export interface FixtureJob {
    id: string;
    title: string;
    company: string;
    location: string;
    extra?: string;
}

const RULE = "-".repeat(57);

function htmlEscape(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
}

function jobBlock(job: FixtureJob, slash: string): string {
    const href = `https://www.linkedin.com/comm/jobs/view/${job.id}${slash}?trackingId=abc%3D%3D&amp;refId=xyz`;
    const extra = job.extra === undefined ? "" : `<p class="text-system-gray-100 text-xs">${htmlEscape(job.extra)}</p>`;
    return `<tr><td><a href="${href}"><img src="logo.png" alt=""></a></td><td class="pb-0"><a href="${href}" class="font-bold">${htmlEscape(job.title)}</a><p class="text-system-gray-100 text-xs">${htmlEscape(job.company)} &middot; ${htmlEscape(job.location)}</p>${extra}</td></tr>`;
}

export function searchAlert(jobs: FixtureJob[], keywords: string): string {
    const search = `https://www.linkedin.com/comm/jobs/search-results/?keywords=${encodeURIComponent(keywords)}&amp;geoId=123&amp;distance=25`;
    return `<html><body><p>Your job alert for ${htmlEscape(keywords)}</p><table>${jobs.map((job) => jobBlock(job, "/")).join(RULE)}</table><a href="${search}">See all jobs</a></body></html>`;
}

export function digest(jobs: FixtureJob[]): string {
    return `<html><body><p>Jobs you may be interested in</p><table>${jobs.map((job) => jobBlock(job, "")).join(`<p>${RULE}</p>`)}</table></body></html>`;
}

export function notification(): string {
    return `<html><body><p>Someone viewed your profile</p><a href="https://www.linkedin.com/help/linkedin/answer/123">Help</a></body></html>`;
}

export function alertEmail(uid: number, from: string, html: string): AlertEmail {
    return { uid, from, subject: `subject ${uid}`, html };
}

export function fixtureJob(index: number, start = 4100000000): FixtureJob {
    return { id: String(start + index), title: `Senior Engineer ${index}`, company: `Company ${index}`, location: "Boise, ID" };
}

export function fixtureJobs(count: number, start = 4100000000): FixtureJob[] {
    return Array.from({ length: count }, (_, index) => fixtureJob(index, start));
}

export const SEARCH_SENDER = "jobalerts-noreply@linkedin.com";
export const DIGEST_SENDER = "jobs-noreply@linkedin.com";
