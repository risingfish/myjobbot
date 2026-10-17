import { expect, test } from "vitest";
import { fitPage } from "../src/careers/fitPage.js";

const link = (text: string) => ({ text, url: `https://acme.example/${encodeURIComponent(text)}` });

test("the link matching the sought title comes first", () => {
    const fitted = fitPage({ text: "Open jobs", links: [link("Data Analyst"), link("Senior Backend Engineer")] }, { maxChars: 2000, sought: "Backend Engineer" });
    expect(fitted.links.map((each) => each.text)).toEqual(["Senior Backend Engineer", "Data Analyst"]);
});

test("links take at most half the budget and the whole page stays within it", () => {
    const links = Array.from({ length: 100 }, (_, index) => link(`Account Executive ${index}`));
    const fitted = fitPage({ text: "x".repeat(5000), links }, { maxChars: 2000 });
    const linkChars = fitted.links.reduce((sum, each) => sum + each.text.length + 20, 0);
    expect(linkChars).toBeLessThanOrEqual(1000);
    expect(fitted.chars).toBeLessThanOrEqual(2000);
    expect(fitted.cut).toBe(true);
});

test("a page that fits is not cut", () => {
    expect(fitPage({ text: "Short text", links: [link("One job")] }, { maxChars: 2000 })).toEqual({ text: "Short text", links: [link("One job")], cut: false, chars: 10 + 7 + 20 });
});

test("an empty page stays empty and is not cut", () => {
    expect(fitPage({ text: "", links: [] }, { maxChars: 2000 })).toEqual({ text: "", links: [], cut: false, chars: 0 });
});
