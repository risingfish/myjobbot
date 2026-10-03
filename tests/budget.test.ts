import { expect, test } from "vitest";
import { Budget } from "../src/agent/budget.js";

const LIMITS = { max_steps: 2, max_wall_clock_min: 1, max_consecutive_tool_errors: 2, context_chars: 160_000 };

test("budget reports the step limit", () => {
  const budget = new Budget(LIMITS, () => 0);
  budget.countStep();
  expect(budget.exhaustedReason()).toBeNull();
  budget.countStep();
  expect(budget.exhaustedReason()).toBe("step limit of 2 reached");
});

test("budget reports wall-clock exhaustion", () => {
  let now = 0;
  const budget = new Budget(LIMITS, () => now);
  now = 60_000;
  expect(budget.exhaustedReason()).toBe("wall-clock budget exhausted");
});

test("budget resets consecutive errors after a success", () => {
  const budget = new Budget(LIMITS, () => 0);
  budget.recordOutcome(false);
  budget.recordOutcome(true);
  budget.recordOutcome(false);
  expect(budget.exhaustedReason()).toBeNull();
  budget.recordOutcome(false);
  expect(budget.exhaustedReason()).toBe("2 consecutive tool errors");
});
