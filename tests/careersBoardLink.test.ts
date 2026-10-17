import { expect, test } from "vitest";
import { parseBoardLink } from "../src/sources/boardLink.js";

const UUID = "bc5ec53c-b1e3-4154-bf4a-f6f27889904f";

test.each([
    [`https://jobs.ashbyhq.com/Vetcove`, { kind: "ashby", slug: "Vetcove", postingId: null }],
    [`https://jobs.ashbyhq.com/Vetcove/${UUID}`, { kind: "ashby", slug: "Vetcove", postingId: UUID }],
    ["https://boards.greenhouse.io/affirm", { kind: "greenhouse", slug: "affirm", postingId: null }],
    ["https://job-boards.greenhouse.io/affirm/jobs/7815948003", { kind: "greenhouse", slug: "affirm", postingId: "7815948003" }],
    ["https://jobs.lever.co/acme", { kind: "lever", slug: "acme", postingId: null }],
    [`https://jobs.lever.co/acme/${UUID}`, { kind: "lever", slug: "acme", postingId: UUID }],
    ["https://cisco.wd5.myworkdayjobs.com/Cisco_Careers", { kind: "workday", slug: "cisco", postingId: null, host: "cisco.wd5.myworkdayjobs.com", site: "Cisco_Careers" }],
    ["https://cisco.wd5.myworkdayjobs.com/en-US/Cisco_Careers/job/San-Jose/Engineer_R1", { kind: "workday", slug: "cisco", postingId: "/job/San-Jose/Engineer_R1", host: "cisco.wd5.myworkdayjobs.com", site: "Cisco_Careers" }],
])("%s is a board link", (url, link) => {
    expect(parseBoardLink(url)).toEqual(link);
});

test.each([
    "https://boards.greenhouse.io/embed/job_app?for=affirm&token=1",
    "https://careers.example.com/en-US/External/job/X_R1",
    "https://jobs.ashbyhq.com/",
    "http://evil.wd1.myworkdayjobs.com.attacker.example/x",
    "https://x.wd1.myworkdayjobs.com:8443/s",
    "https://jobs.lever.co/acme/123/extra/parts",
    "ftp://jobs.lever.co/acme",
])("%s is not a board link", (url) => {
    expect(parseBoardLink(url)).toBeNull();
});
