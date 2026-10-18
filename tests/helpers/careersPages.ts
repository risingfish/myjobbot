import type { PageRead } from "../../src/careers/readPage.js";
import type { TrimmedPage } from "../../src/careers/trim.js";

interface ListedJob {
    title: string;
    href: string;
}

interface ListingOptions {
    singleQuotes?: boolean;
    hiddenBlock?: boolean;
    nextLink?: boolean;
    chrome?: boolean;
}

const CHROME_HEAD = "<head><title>Careers</title><style>.x { color: red }</style><script>if (a < b) { decoy('script text') }</script></head>";
const CHROME_NAV = "<nav><a href='/about'>Nav decoy</a></nav><header>Header decoy</header>";
const HIDDEN = '<div hidden><a href="/jobs/hidden-1">Hidden Decoy Engineer</a></div><div style="display: none"><a href="/jobs/hidden-2">Styled Decoy Engineer</a></div><p aria-hidden="true">Aria decoy</p>';

function anchor(job: ListedJob, singleQuotes: boolean): string {
    return singleQuotes ? `<li><a href='${job.href}' class='job'>${job.title}</a></li>` : `<li><a href="${job.href}">${job.title}</a></li>`;
}

export function listingPage(jobs: ListedJob[], options: ListingOptions = {}): string {
    const items = jobs.map((job) => anchor(job, options.singleQuotes === true)).join("");
    const body = [options.chrome ? CHROME_NAV : "", "<h1>Open roles</h1>", options.hiddenBlock ? HIDDEN : "", `<ul>${items}</ul>`, options.nextLink ? '<a rel="next" href="?page=2">2</a>' : "", options.chrome ? "<footer>Footer decoy</footer>" : ""];
    return `<html>${options.chrome ? CHROME_HEAD : ""}<body>${body.join("")}</body></html>`;
}

export function jobPage(title: string, paragraphs: string[]): string {
    return `<html><body><nav>Nav decoy</nav><h1>${title}</h1>${paragraphs.map((text) => `<p>${text}</p>`).join("")}<a href="/apply">Apply</a></body></html>`;
}

export function scriptOnlyPage(): string {
    return '<html><head><script src="/app.js"></script></head><body><div id="root"></div><noscript>Enable JavaScript</noscript></body></html>';
}

export function searxngJson(results: Array<{ url: string; title: string; content?: string }>) {
    return { query: "Acme careers", results: results.map((result) => ({ template: "default.html", engine: "fake", ...result })), answers: [], suggestions: [] };
}

export function asRead(page: TrimmedPage): PageRead {
    return { ...page, source: "html", fallback: null, board: null };
}
