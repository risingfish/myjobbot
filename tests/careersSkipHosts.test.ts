import { expect, test } from "vitest";
import { dropSkipped } from "../src/careers/skipHosts.js";

const result = (url: string) => ({ url, title: "Acme careers", snippet: "" });

test("results on a skipped host or any of its subdomains are dropped, and look-alike hosts are kept", () => {
    const results = ["https://www.glassdoor.com/acme", "https://glassdoor.com/acme", "https://uk.indeed.com/acme", "https://notglassdoor.com/acme", "https://glassdoor.com.example/acme", "https://acme.example/careers"].map(result);
    expect(dropSkipped(results, ["glassdoor.com", "indeed.com"]).map((each) => each.url)).toEqual(["https://notglassdoor.com/acme", "https://glassdoor.com.example/acme", "https://acme.example/careers"]);
});
