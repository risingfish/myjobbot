import { expect, test } from "vitest";
import { isDomainEntry, isValidDomainEntry, linkMatchesDomains } from "../src/jobs/publisherDomain.js";

test("an entry with a dot and no whitespace is a domain entry", () => {
    expect(isDomainEntry("jobmesh.io")).toBe(true);
    expect(isDomainEntry("*.trabajo.org")).toBe(true);
    expect(isDomainEntry("Remote.co")).toBe(true);
});

test("an entry without a dot, or with whitespace, is a name entry", () => {
    expect(isDomainEntry("dailyremote")).toBe(false);
    expect(isDomainEntry("stripe careers")).toBe(false);
    expect(isDomainEntry("foo bar.com")).toBe(false);
});

test("a plain domain matches its exact host, ignoring case, trailing dot, port and credentials", () => {
    expect(linkMatchesDomains("https://jobmesh.io/job/1", ["jobmesh.io"])).toBe(true);
    expect(linkMatchesDomains("https://jobmesh.io/job/1", ["JobMesh.IO"])).toBe(true);
    expect(linkMatchesDomains("https://JobMesh.IO./x", ["jobmesh.io"])).toBe(true);
    expect(linkMatchesDomains("https://user@jobmesh.io:8443/a", ["jobmesh.io"])).toBe(true);
    expect(linkMatchesDomains("https://Bücher.DE/x", ["bücher.de"])).toBe(true);
    expect(linkMatchesDomains("jobmesh.io/job/1", ["jobmesh.io"])).toBe(true);
    expect(linkMatchesDomains("https://jobmesh.io/job/1", ["jobmesh.io", "JOBMESH.IO"])).toBe(true);
});

test("non-ASCII capitals are ignored on both the entry and the link", () => {
    expect(isValidDomainEntry("Öko-jobs.de")).toBe(true);
    expect(linkMatchesDomains("https://Öko-jobs.de/x", ["öko-jobs.de"])).toBe(true);
    expect(linkMatchesDomains("https://öko-jobs.de/x", ["*.Öko-jobs.de"])).toBe(true);
});

test("a plain domain matches no subdomain or look-alike host", () => {
    expect(linkMatchesDomains("https://www.jobmesh.io/", ["jobmesh.io"])).toBe(false);
    expect(linkMatchesDomains("https://notjobmesh.io/", ["jobmesh.io"])).toBe(false);
    expect(linkMatchesDomains("https://jobmesh.io.example.com/", ["jobmesh.io"])).toBe(false);
});

test("a wildcard domain matches the domain itself and subdomains at any depth", () => {
    expect(linkMatchesDomains("https://trabajo.org/x", ["*.trabajo.org"])).toBe(true);
    expect(linkMatchesDomains("https://us.trabajo.org/job-1", ["*.trabajo.org"])).toBe(true);
    expect(linkMatchesDomains("https://jobs.eu.trabajo.org/", ["*.trabajo.org"])).toBe(true);
});

test("a wildcard domain matches no look-alike host", () => {
    expect(linkMatchesDomains("https://nottrabajo.org/", ["*.trabajo.org"])).toBe(false);
    expect(linkMatchesDomains("https://trabajo.org.example.com/", ["*.trabajo.org"])).toBe(false);
});

test("bare hosts with a registrable domain are valid entries, with or without a wildcard", () => {
    for (const entry of ["jobmesh.io", "JobMesh.IO", "trabajo.org.", "*.trabajo.org", "bücher.de", "a_b.com"]) {
        expect(isValidDomainEntry(entry)).toBe(true);
    }
});

test("malformed hosts, URLs, ports, public suffixes and IPs are invalid entries", () => {
    const invalid = ["trabajo.*", "*trabajo.org", "*.", "a..b", "-a.com", "https://trabajo.org/", "trabajo.org:443", "*.com", "co.uk", ".com", "1.2.3.4"];
    for (const entry of invalid) {
        expect(isValidDomainEntry(entry)).toBe(false);
    }
});

test("a link without a readable host never matches a domain", () => {
    for (const link of ["garbage", "see jobmesh.io", "/jobs/view/1", ""]) {
        expect(linkMatchesDomains(link, ["jobmesh.io"])).toBe(false);
    }
    expect(linkMatchesDomains("https://jobmesh.io/job/1", [])).toBe(false);
});
