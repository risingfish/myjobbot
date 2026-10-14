import { NextRequest } from "next/server.js";
import { afterEach, expect, test, vi } from "vitest";
import { proxy } from "../web/proxy.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

function statusFor(host?: string): number {
  const headers: Record<string, string> = host ? { host } : {};
  return proxy(new NextRequest("http://placeholder/jobs", { headers })).status;
}

function useDefaults(): void {
  vi.stubEnv("MYJOBBOT_HOSTS", undefined);
  vi.stubEnv("MYJOBBOT_PORT", undefined);
}

test("by default only localhost and 127.0.0.1 on port 8080 get through", () => {
  useDefaults();
  expect(statusFor("localhost:8080")).toBe(200);
  expect(statusFor("127.0.0.1:8080")).toBe(200);
  expect(statusFor("localhost:3000")).toBe(421);
});

test("the default port follows MYJOBBOT_PORT", () => {
  useDefaults();
  vi.stubEnv("MYJOBBOT_PORT", "9000");
  expect(statusFor("localhost:9000")).toBe(200);
  expect(statusFor("localhost:8080")).toBe(421);
});

test("a foreign host is refused with 421", () => {
  useDefaults();
  expect(statusFor("evil.example:8080")).toBe(421);
});

test("MYJOBBOT_HOSTS lists the allowed hosts, ignoring case", () => {
  vi.stubEnv("MYJOBBOT_HOSTS", "myserver.lan:8080,192.168.1.20:8080");
  expect(statusFor("myserver.lan:8080")).toBe(200);
  expect(statusFor("192.168.1.20:8080")).toBe(200);
  expect(statusFor("MyServer.LAN:8080")).toBe(200);
  expect(statusFor("localhost:8080")).toBe(421);
});

test("a request without a Host header is refused", () => {
  useDefaults();
  expect(statusFor()).toBe(421);
});
