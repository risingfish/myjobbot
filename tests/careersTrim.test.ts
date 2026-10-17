import { expect, test } from "vitest";
import { trimPage } from "../src/careers/trim.js";
import { jobPage, listingPage } from "./helpers/careersPages.js";

const BASE = "https://acme.example/careers/";
const JOBS = [
    { title: "Data Analyst", href: "/careers/data-analyst" },
    { title: "Senior Backend Engineer", href: "https://acme.example/careers/backend#apply" },
];

function trim(html: string, extra: { maxChars?: number; sought?: string; links?: boolean } = {}) {
    return trimPage(html, { baseUrl: BASE, maxChars: extra.maxChars ?? 12_000, ...extra });
}

test("chrome elements and their text are dropped", () => {
    const page = trim(listingPage(JOBS, { chrome: true }));
    expect(page.text).toContain("Open roles");
    expect(page.text).not.toMatch(/decoy|color: red|Careers$/i);
    expect(page.links.map((link) => link.text)).not.toContain("Nav decoy");
});

test("hidden elements are dropped, whether hidden, aria-hidden or display:none", () => {
    const page = trim(listingPage(JOBS, { hiddenBlock: true }));
    expect(page.text).not.toMatch(/decoy/i);
    expect(page.links.map((link) => link.text)).toEqual(["Data Analyst", "Senior Backend Engineer"]);
});

test("block elements become line breaks and whitespace is collapsed", () => {
    const page = trim(jobPage("Backend   Engineer", ["Build  APIs.", "Ship\n\n code."]));
    expect(page.text).toBe("Backend Engineer\nBuild APIs.\nShip code.\nApply");
});

test("links come back unnumbered, deduplicated, without fragments or non-web schemes; links:false returns none", () => {
    const html = `${listingPage(JOBS)}<a href="/careers/data-analyst">Data Analyst again</a><a href="mailto:jobs@acme.example">Mail</a><a href="javascript:void(0)">Script</a>`;
    expect(trim(html).links).toEqual([
        { text: "Data Analyst", url: "https://acme.example/careers/data-analyst" },
        { text: "Senior Backend Engineer", url: "https://acme.example/careers/backend" },
    ]);
    const bare = trim(html, { links: false });
    expect(bare.links).toEqual([]);
    expect(bare.text).toContain("Senior Backend Engineer");
});

test("relative links are resolved against the base address", () => {
    const page = trim('<a href="engineer">Engineer</a><a href="../about">About</a>');
    expect(page.links.map((link) => link.url)).toEqual(["https://acme.example/careers/engineer", "https://acme.example/about"]);
});

test("single-quoted and unquoted attributes are read", () => {
    const page = trim(`${listingPage(JOBS, { singleQuotes: true })}<a href=/careers/sre>SRE</a>`);
    expect(page.links.map((link) => link.url)).toEqual(["https://acme.example/careers/data-analyst", "https://acme.example/careers/backend", "https://acme.example/careers/sre"]);
});

test("a link with no text uses its title or aria-label, and is dropped without either", () => {
    const page = trim('<a href="/a" title="Platform Engineer"><img src="x.png"></a><a href="/b" aria-label="QA Engineer"></a><a href="/c"><img src="y.png"></a>');
    expect(page.links.map((link) => link.text)).toEqual(["Platform Engineer", "QA Engineer"]);
});

test("more_pages is true for rel=next or a Next/» link, and false otherwise", () => {
    expect(trim(listingPage(JOBS, { nextLink: true })).morePages).toBe(true);
    expect(trim(`${listingPage(JOBS)}<a href="?p=2">Next</a>`).morePages).toBe(true);
    expect(trim(`${listingPage(JOBS)}<a href="?p=2"> » </a>`).morePages).toBe(true);
    expect(trim(listingPage(JOBS)).morePages).toBe(false);
});

test("the result never exceeds maxChars and says cut when it hit the cap", () => {
    const long = jobPage(
        "Engineer",
        Array.from({ length: 200 }, (_, index) => `Paragraph ${index} about the role and the team.`),
    );
    const page = trim(long, { maxChars: 2000 });
    expect(page.chars).toBeLessThanOrEqual(2000);
    expect(page.text.length).toBeLessThanOrEqual(2000);
    expect(page.cut).toBe(true);
    expect(trim(jobPage("Engineer", ["Short."])).cut).toBe(false);
});

test("with a sought title, matching links come first so cutting keeps them", () => {
    const filler = Array.from({ length: 60 }, (_, index) => ({ title: `Account Executive ${index}`, href: `/careers/ae-${index}` }));
    const html = listingPage([...filler, { title: "Senior Backend Engineer", href: "/careers/backend" }]);
    const page = trim(html, { maxChars: 600, sought: "Backend Engineer" });
    expect(page.links[0]?.text).toBe("Senior Backend Engineer");
    expect(page.cut).toBe(true);
});
