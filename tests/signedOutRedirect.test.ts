import { expect, test } from "vitest";
import { afterStreamFailure } from "../src/web/signedOut.js";

test("a live stream that fails because the browser is signed out sends the page to sign in, returning to it; any other failure doesn't", () => {
    expect(afterStreamFailure(401, "/jobs?job=x")).toBe("/sign-in?next=%2Fjobs%3Fjob%3Dx");
    expect(afterStreamFailure(204, "/jobs?job=x")).toBeNull();
    expect(afterStreamFailure(500, "/jobs")).toBeNull();
});
