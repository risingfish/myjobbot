import { expect, test } from "vitest";
import { isLoopbackHost } from "../src/gmail/connectRequest.js";

test("only localhost and 127.0.0.1 count as loopback hosts", () => {
    expect(["localhost:8080", "127.0.0.1:8080", "LOCALHOST:3000"].map(isLoopbackHost)).toEqual([true, true, true]);
    expect(["192.168.1.20:8080", "localhost.evil.com", "localhost:8080.evil.com", ""].map(isLoopbackHost)).toEqual([false, false, false, false]);
});
