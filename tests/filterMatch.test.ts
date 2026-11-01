import { expect, test } from "vitest";
import { filterMatch } from "../src/jobs/filterMatch.js";

const FILTERS = { excludedCompanies: ["acme"], titleFilter: { include: ["engineer"], exclude: ["manager"] }, bodyFilter: { include: [], exclude: ["clearance"] } };
const JOB = { title: "Software Engineer", company: "Initech", description: "We write Go.", description_format: "text" as const };

test("filters are named in the order company, title, body, and a job none matches gives null", () => {
    const all = { title: "Engineering Manager", company: "Acme", description: "Clearance required.", description_format: "text" as const };
    expect(filterMatch(all, FILTERS)).toBe("company");
    expect(filterMatch({ ...all, company: "Initech" }, FILTERS)).toBe("title");
    expect(filterMatch({ ...all, company: "Initech", title: "Software Engineer" }, FILTERS)).toBe("body");
    expect(filterMatch(JOB, FILTERS)).toBeNull();
});
