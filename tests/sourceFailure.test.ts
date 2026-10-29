import { expect, test } from "vitest";
import { z } from "zod";
import { FetchRefused } from "../src/careers/fetchPage.js";
import { HttpStatusError, NetworkError } from "../src/http/errors.js";
import { failureReason, NotSetUp } from "../src/sources/failure.js";

const SECRET = "https://boards-api.greenhouse.io/v1/boards/secret-slug/jobs";

test("a failure gives a fixed reason by its kind, found through its causes, and never its own message", () => {
    const zodFailure = z.object({ jobs: z.array(z.string()) }).safeParse({ jobs: 5 }).error;
    const failures: Array<[unknown, string]> = [
        [new HttpStatusError(`GET ${SECRET} failed with HTTP 404`, 404), "not found"],
        [new HttpStatusError(`GET ${SECRET} failed with HTTP 401`, 401), "refused"],
        [new Error("JSearch refused the request", { cause: new HttpStatusError(`GET ${SECRET} failed with HTTP 403`, 403) }), "refused"],
        [new HttpStatusError(`GET ${SECRET} failed with HTTP 500`, 500), "unexpected answer"],
        [zodFailure, "unexpected answer"],
        [new NetworkError(`GET ${SECRET} failed: ECONNRESET`), "unreachable"],
        [new FetchRefused("refused: the address is not on the public internet"), "refused"],
        [new NotSetUp("JSEARCH_API_KEY is not set"), "not set up"],
        [new Error(`something odd about ${SECRET}`), "unexpected answer"],
        ["not even an error", "unexpected answer"],
    ];
    expect(failures.map(([error]) => failureReason(error))).toEqual(failures.map(([, reason]) => reason));
});
