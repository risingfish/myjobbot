import { expect, test } from "vitest";
import { GoogleError, guarded } from "../src/gmail/googleErrors.js";

async function codeFor(thrown: unknown): Promise<string> {
    const error = await guarded(async () => Promise.reject(thrown)).catch((caught: unknown) => caught);
    if (!(error instanceof GoogleError)) throw new Error("expected a GoogleError");
    expect(`${String(error)} ${JSON.stringify(error)} ${error.stack ?? ""}`).not.toContain("SECRET123");
    return error.code;
}

test("library errors become a fixed code that never carries the request", async () => {
    const tokenError = Object.assign(new Error("invalid_client"), { config: { body: "client_secret=SECRET123&code=abc" }, response: { status: 401, data: { error: "invalid_client" } } });
    expect(await codeFor(tokenError)).toBe("invalid_client");
    expect(await codeFor({ response: { status: 401, data: { error: { code: 401, status: "UNAUTHENTICATED" } } } })).toBe("invalid_grant");
    expect(await codeFor(Object.assign(new Error("connect ECONNREFUSED SECRET123"), { code: "ECONNREFUSED" }))).toBe("network");
    expect(await codeFor({ response: { status: 500, data: "oops" } })).toBe("unknown");
    expect(await codeFor("weird")).toBe("unknown");
    expect(await codeFor(new GoogleError("access_denied"))).toBe("access_denied");
});
