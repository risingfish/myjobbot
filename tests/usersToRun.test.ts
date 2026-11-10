import { expect, test } from "vitest";
import { usersToRun } from "../src/app/usersToRun.js";

const ready = { sourcesOn: 1, uploadedResume: true, resumeFile: false, deactivated: false };

test("every user is planned in id order, one without an email included", () => {
    const plan = usersToRun([
        { userId: 3, ...ready },
        { userId: 1, ...ready },
        { userId: 2, ...ready },
    ]);
    expect(plan.map((step) => step.userId)).toEqual([1, 2, 3]);
});

test("a user with no source on or no resume is skipped with its reason, and only the owner's resume file counts", () => {
    const plan = usersToRun([
        { userId: 1, sourcesOn: 2, uploadedResume: false, resumeFile: true, deactivated: false },
        { userId: 2, sourcesOn: 2, uploadedResume: false, resumeFile: true, deactivated: false },
        { userId: 3, sourcesOn: 0, uploadedResume: true, resumeFile: false, deactivated: false },
    ]);
    expect(plan).toEqual([{ userId: 1, run: true }, { userId: 2, skipped: "no resume" }, { userId: 3, skipped: "no sources are on" }]);
});

test("a deactivated user is skipped before their sources and resume are looked at", () => {
    const plan = usersToRun([
        { userId: 1, ...ready, deactivated: true },
        { userId: 2, sourcesOn: 0, uploadedResume: false, resumeFile: false, deactivated: true },
        { userId: 3, ...ready },
    ]);
    expect(plan).toEqual([{ userId: 1, skipped: "deactivated" }, { userId: 2, skipped: "deactivated" }, { userId: 3, run: true }]);
});
