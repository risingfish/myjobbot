import { expect, test } from "vitest";
import { HostLimiter } from "../src/http/limiter.js";
import { fakeClock } from "./helpers/clock.js";
import { testFileConfig } from "./helpers/config.js";

const ok = async () => "ok";

function limiter(overrides: Record<string, number> = {}) {
  const clock = fakeClock();
  const config = { ...testFileConfig().http, ...overrides };
  return { clock, limiter: new HostLimiter(config, clock) };
}

test("limiter spaces requests to the same host", async () => {
  const { clock, limiter: hosts } = limiter();
  await hosts.schedule("a.example", ok);
  await hosts.schedule("a.example", ok);
  expect(clock.sleeps).toEqual([1000]);
});

test("limiter does not delay requests to different hosts", async () => {
  const { clock, limiter: hosts } = limiter();
  await hosts.schedule("a.example", ok);
  await hosts.schedule("b.example", ok);
  expect(clock.sleeps).toEqual([]);
});

test("limiter enforces the per-run request cap per host", async () => {
  const { limiter: hosts } = limiter({ max_requests_per_host_per_run: 2 });
  await hosts.schedule("a.example", ok);
  await hosts.schedule("a.example", ok);
  await expect(hosts.schedule("a.example", ok)).rejects.toThrow("rate_limit_cap");
});
