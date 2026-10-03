import type { FileConfig } from "../config/schema.js";
import type { Clock } from "./clock.js";

export class HostLimiter {
  private readonly nextSlot = new Map<string, number>();
  private readonly counts = new Map<string, number>();

  constructor(
    private readonly config: FileConfig["http"],
    private readonly clock: Clock,
  ) {}

  async schedule<T>(host: string, task: () => Promise<T>): Promise<T> {
    this.claim(host);
    const now = this.clock.now();
    const start = Math.max(now, this.nextSlot.get(host) ?? now);
    this.nextSlot.set(host, start + this.config.min_interval_ms);
    if (start > now) await this.clock.sleep(start - now);
    return task();
  }

  private claim(host: string): void {
    const used = this.counts.get(host) ?? 0;
    if (used >= this.config.max_requests_per_host_per_run) {
      throw new Error(`rate_limit_cap: already made ${used} requests to ${host} this run`);
    }
    this.counts.set(host, used + 1);
  }
}
