import type { FileConfig } from "../config/schema.js";

const MS_PER_MINUTE = 60_000;

export class Budget {
  private stepCount = 0;
  private consecutiveErrors = 0;
  private readonly startedAt: number;

  constructor(
    private readonly limits: FileConfig["agent"],
    private readonly clock: () => number,
  ) {
    this.startedAt = clock();
  }

  get steps(): number {
    return this.stepCount;
  }

  countStep(): void {
    this.stepCount += 1;
  }

  recordOutcome(ok: boolean): void {
    this.consecutiveErrors = ok ? 0 : this.consecutiveErrors + 1;
  }

  exhaustedReason(): string | null {
    const { max_steps, max_wall_clock_min, max_consecutive_tool_errors } = this.limits;
    if (this.stepCount >= max_steps) return `step limit of ${max_steps} reached`;
    if (this.clock() - this.startedAt >= max_wall_clock_min * MS_PER_MINUTE) return "wall-clock budget exhausted";
    if (this.consecutiveErrors >= max_consecutive_tool_errors) return `${this.consecutiveErrors} consecutive tool errors`;
    return null;
  }
}
