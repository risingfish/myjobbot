import { expect, test } from "vitest";
import { read, sourceFiles } from "./helpers/sourceScan.js";

test("nothing in the web app or the run names the owner: every request and run acts for a user it was given", () => {
    const naming = [...sourceFiles("web"), ...sourceFiles("src/app")].filter((path) => read(path).includes("OWNER_ID"));
    expect(naming).toEqual([]);
});
