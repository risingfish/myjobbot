import { NextRequest } from "next/server.js";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { proxy } from "../web/proxy.js";

vi.mock("../web/lib/env.js", () => ({ loadRepoEnv: () => {} }));

beforeEach(() => {
    vi.stubEnv("MYJOBBOT_BASE_URL", "http://localhost:8080");
});

afterEach(() => {
    vi.unstubAllEnvs();
});

async function statusFor(host?: string): Promise<number> {
    const headers: Record<string, string> = host ? { host } : {};
    return (await proxy(new NextRequest("http://placeholder/sign-in", { headers }))).status;
}

function useDefaults(): void {
    vi.stubEnv("MYJOBBOT_HOSTS", undefined);
    vi.stubEnv("MYJOBBOT_PORT", undefined);
}

test("by default only localhost and 127.0.0.1 on port 8080 get through", async () => {
    useDefaults();
    expect(await statusFor("localhost:8080")).not.toBe(421);
    expect(await statusFor("127.0.0.1:8080")).not.toBe(421);
    expect(await statusFor("localhost:3000")).toBe(421);
});

test("the default port follows MYJOBBOT_PORT", async () => {
    useDefaults();
    vi.stubEnv("MYJOBBOT_PORT", "9000");
    vi.stubEnv("MYJOBBOT_BASE_URL", "http://localhost:9000");
    expect(await statusFor("localhost:9000")).not.toBe(421);
    expect(await statusFor("localhost:8080")).toBe(421);
});

test("a foreign host is refused with 421", async () => {
    useDefaults();
    expect(await statusFor("evil.example:8080")).toBe(421);
});

test("MYJOBBOT_HOSTS lists the allowed hosts, ignoring case", async () => {
    vi.stubEnv("MYJOBBOT_HOSTS", "myserver.lan:8080,192.168.1.20:8080");
    vi.stubEnv("MYJOBBOT_BASE_URL", "https://myserver.lan:8080");
    expect(await statusFor("myserver.lan:8080")).not.toBe(421);
    expect(await statusFor("192.168.1.20:8080")).not.toBe(421);
    expect(await statusFor("MyServer.LAN:8080")).not.toBe(421);
    expect(await statusFor("localhost:8080")).toBe(421);
});

test("a request without a Host header is refused", async () => {
    useDefaults();
    expect(await statusFor()).toBe(421);
});
