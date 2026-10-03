# myjobbot Agent Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A runnable `myjobbot run` in which a local LLM (llama.cpp, OpenAI-compatible API) drives a tool-calling loop. The model lists target companies, pulls their Greenhouse/Lever/Ashby job boards through a rate limiter, scores every title-filtered posting against the resume, stores verdicts in SQLite with ghost-post tracking, and ends with `finish`.

**Architecture:** A hand-rolled agent loop (`src/agent/`) sends the message history plus tool JSON Schemas to the model. It validates and dispatches tool calls, feeds results back, and enforces budgets in code. Tools (`src/tools/`) are thin adapters over plain modules: config, SQLite store, HTTP client, board adapters. The database is the agent's memory: `fetch_jobs` always returns current state, so old context can be elided safely.

**Tech Stack:** Node 24, TypeScript 6 run via `tsx`, `openai` SDK v7 (pointed at llama.cpp), `zod` 4 (validation + JSON Schema), `yaml`, built-in `node:sqlite`, `vitest` 5, habit-hooks.

**Spec:** `docs/superpowers/specs/2026-10-03-myjobbot-design.md`

---

## Plan series

The spec has several independent subsystems, so it is split into plans. Each plan produces working software:

1. **Agent core (this plan):** CLI, config, SQLite, rate-limited HTTP, three board adapters, the agent loop and its tools (`list_companies`, `fetch_jobs`, `get_job_details` stub, `record_matches`, `finish`), context compaction, traces, and a live smoke run.
2. **Digest & observability:** `send_digest`, HTML email via SMTP, `--dry-run`, failure email, `runs` table, `myjobbot trace`.
3. **Glassdoor:** `get_company_rating` with Playwright, cache, and politeness limits.
4. **Deployment:** Dockerfile, cron, starter company list.

## Rules that shape every task (read before starting)

habit-hooks runs on every `.ts` file you write (PostToolUse hook) and on the whole project when a turn ends (Stop hook). Any finding, enforced or suggested, is fed back as blocking. Write code that already complies:

- **Functions ≤ 12 lines**, counting the signature, closing brace, blank lines and comments. This includes test callbacks and arrow functions nested inside other functions. Use **top-level `test()` calls; no `describe`**.
- **≤ 3 parameters** (use an object), **complexity ≤ 10**, **nesting ≤ 4**, **files ≤ 200 lines**.
- `===` only, no `var`, `const` unless reassigned, and **no inferrable type annotations**. `x = 5` not `x: number = 5`; this includes default parameters.
- **No comments**; names carry the meaning. **No `TODO`, no `any`, no `!` non-null assertions, no empty `catch`.**
- **No dead code.** knip runs a production pass with `src/cli.ts` as the entry point. A file nothing reaches from `src/cli.ts` is `unused-file`. An export only tests use is `test-only-dead-code`. An unused export or class member is flagged. A `package.json` dependency nothing imports is `unused-dependency`.
  - So each task **wires its new modules into the `run` path before it ends**, and dependencies are installed in the task that first imports them.
  - Test helpers live in `tests/helpers/`, never in `src/`.
  - Only export what another `src/` file imports.
- **Transient findings inside a task are expected.** Writing a test before its module, or a module one step before its call site, gets reported by the PostToolUse hook. Resolve these by finishing the task's steps in order. Never snooze, ignore-list or otherwise silence a finding. By each task's final "Verify" step, `habit-hooks` must print `✅ Habit Hooks: automated checks passed.`
- New dependencies get exact pins (`--save-exact`) and must be in `package-lock.json`.

Commands used throughout:

- `npm test` → `vitest run`
- `npm run typecheck` → `tsc --noEmit`
- `habit-hooks` → structural checks (exit 0 = clean)
- `npm run check` → all three (added in Task 1)

## File structure (end state of this plan)

```
src/
  cli.ts                  entry: parses argv, loads .env, runs `run`, prints the report
  errors.ts               describeError(): readable text for zod and other errors
  app/run.ts              runOnce(): wires config → context → tools → agent; prunes old jobs
  config/schema.ts        zod schemas + defaults for config.yaml and env
  config/load.ts          loadConfig(): reads env, config.yaml, resume.md
  jobs/job.ts             Job model, ATS names, makeJob()
  jobs/normalize.ts       normalizeTitle()
  jobs/titleFilter.ts     passesTitleFilter()
  jobs/age.ts             daysBetween(), MS_PER_DAY
  db/open.ts              openDatabase() + schema DDL
  db/jobStore.ts          JobStore: upsert, unscored page, verdicts, ghost dates, prune, find
  http/client.ts          HttpClient: JSON GET with timeout, retry/backoff, Retry-After
  http/limiter.ts         HostLimiter: per-host interval + per-run request cap
  http/clock.ts           Clock interface + systemClock
  sources/types.ts        BoardRef, BoardFetcher
  sources/fields.ts       zod helpers for nullable text/flag/date fields
  sources/greenhouse.ts   Greenhouse board adapter
  sources/lever.ts        Lever board adapter
  sources/ashby.ts        Ashby board adapter
  sources/index.ts        fetcherFor(ats)
  tools/tool.ts           Tool interface + defineTool() (zod → JSON Schema, validated invoke)
  tools/dispatch.ts       dispatch(): run one tool call, never throw
  tools/context.ts        ToolContext, newRunState()
  tools/registry.ts       buildTools()
  tools/jobSummary.ts     summarizeJob(): compact job view for the model
  tools/finish.ts / listCompanies.ts / fetchJobs.ts / recordMatches.ts / getJobDetails.ts
  agent/llm.ts            createChat() over the openai SDK, message types
  agent/loop.ts           runAgent(): the loop, guardrails, trace events
  agent/budget.ts         Budget: steps, wall clock, consecutive errors
  agent/compact.ts        compactInPlace(): collapse old turns into one notice (see spec)
  agent/prompt.ts         initialMessages(): system prompt + resume
  agent/trace.ts          fileTrace(): JSONL trace writer
tests/
  helpers/                cli, dataDir, config, context, chat, agent, tools, http, clock, boards, fixtures
  fixtures/               greenhouse.json, lever.json, ashby.json
  *.test.ts
examples/                 config.yaml, resume.md
```

---

### Task 1: Tooling and CLI skeleton

**Files:**
- Modify: `package.json` (scripts, deps)
- Replace: `tsconfig.json`
- Create: `src/cli.ts`, `tests/helpers/cli.ts`, `tests/cli.test.ts`

- [ ] **Step 1: Install tooling**

```bash
npm install --save-exact tsx@4.23.15
npm install --save-dev --save-exact vitest@5.0.3 @types/node@26.6.4
npm pkg set scripts.start="NODE_OPTIONS=--disable-warning=ExperimentalWarning tsx src/cli.ts" \
  scripts.test="vitest run" scripts.typecheck="tsc --noEmit" \
  scripts.check="npm run typecheck && npm test && habit-hooks"
```

- [ ] **Step 2: Replace `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Write the failing test**

`tests/helpers/cli.ts`:

```ts
import { spawnSync } from "node:child_process";

export interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export function runCli(args: string[], env: NodeJS.ProcessEnv = {}): CliResult {
  const result = spawnSync("node_modules/.bin/tsx", ["src/cli.ts", ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}
```

`tests/cli.test.ts`:

```ts
import { expect, test } from "vitest";
import { runCli } from "./helpers/cli.js";

test("cli prints usage and exits 2 without a command", () => {
  const result = runCli([]);
  expect(result.status).toBe(2);
  expect(result.stderr).toContain("usage: myjobbot run");
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. `tsx` cannot find `src/cli.ts`, so the status is 1, not 2.

- [ ] **Step 5: Implement `src/cli.ts`**

```ts
import { parseArgs } from "node:util";

const USAGE = "usage: myjobbot run";

async function main(argv: string[]): Promise<number> {
  const { positionals } = parseArgs({ args: argv, allowPositionals: true });
  if (positionals[0] !== "run") {
    console.error(USAGE);
    return 2;
  }
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
```

- [ ] **Step 6: Verify**

Run: `npm run check`
Expected: typecheck clean, 1 test passes, `✅ Habit Hooks: automated checks passed.`

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json src/cli.ts tests/
git commit -m "Add TypeScript tooling and CLI skeleton"
```

---

### Task 2: Configuration loading

**Files:**
- Create: `src/jobs/job.ts`, `src/config/schema.ts`, `src/config/load.ts`, `src/errors.ts`, `src/app/run.ts`
- Modify: `src/cli.ts`, `tests/cli.test.ts`, `.gitignore`
- Create: `tests/helpers/dataDir.ts`, `tests/config.test.ts`, `examples/config.yaml`, `examples/resume.md`, `.env.example`

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-exact zod@4.6.5 yaml@2.9.1
```

- [ ] **Step 2: Write the failing tests**

`tests/helpers/dataDir.ts`:

```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const SAMPLE_CONFIG = `companies:
  - { name: Stripe, ats: greenhouse, slug: stripe }
  - { name: Palantir, ats: lever, slug: palantir }
preferences: Remote US, senior backend
`;

export const TEST_ENV = {
  LLM_BASE_URL: "http://127.0.0.1:9/v1",
  LLM_MODEL: "test-model",
  LLM_API_KEY: "test-key",
};

export function makeDataDir(config = SAMPLE_CONFIG): string {
  const dir = mkdtempSync(join(tmpdir(), "myjobbot-"));
  writeFileSync(join(dir, "config.yaml"), config);
  writeFileSync(join(dir, "resume.md"), "# Jane Doe\nSenior backend engineer, Go and TypeScript.\n");
  return dir;
}
```

`tests/config.test.ts`:

```ts
import { expect, test } from "vitest";
import { loadConfig } from "../src/config/load.js";
import { makeDataDir, TEST_ENV } from "./helpers/dataDir.js";

test("loadConfig applies defaults", () => {
  const config = loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: makeDataDir() });
  expect(config.file.companies).toHaveLength(2);
  expect(config.file.match_threshold).toBe(70);
  expect(config.file.http.min_interval_ms).toBe(1000);
  expect(config.file.title_filter.include).toContain("engineer");
  expect(config.resume).toContain("Jane Doe");
});

test("loadConfig rejects an unknown board type", () => {
  const dir = makeDataDir("companies:\n  - { name: X, ats: workday, slug: x }\n");
  expect(() => loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dir })).toThrow(/ats/);
});

test("loadConfig requires LLM settings", () => {
  expect(() => loadConfig({ MYJOBBOT_DATA_DIR: makeDataDir() })).toThrow(/LLM_BASE_URL/);
});
```

Append to `tests/cli.test.ts`:

```ts
import { makeDataDir } from "./helpers/dataDir.js";

test("cli reports configuration errors readably", () => {
  const env = { MYJOBBOT_DATA_DIR: makeDataDir(), LLM_BASE_URL: "not a url", LLM_MODEL: "m", LLM_API_KEY: "k" };
  const result = runCli(["run"], env);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("myjobbot:");
  expect(result.stderr).toContain("LLM_BASE_URL");
});
```

(Move the new `import` line up with the other imports at the top of the file.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. `src/config/load.js` cannot be resolved, and the CLI test gets status 0.

- [ ] **Step 4: Implement**

`src/jobs/job.ts`:

```ts
export const ATS_NAMES = ["greenhouse", "lever", "ashby"] as const;
```

`src/config/schema.ts`:

```ts
import { z } from "zod";
import { ATS_NAMES } from "../jobs/job.js";

const DEFAULT_INCLUDE = [
  "engineer", "developer", "software", "sre", "devops", "platform",
  "backend", "frontend", "full stack", "fullstack", "programmer",
];
const DEFAULT_EXCLUDE = ["intern", "manager", "director", "sales", "recruit"];

const company = z.object({
  name: z.string().min(1),
  ats: z.enum(ATS_NAMES),
  slug: z.string().min(1),
});

const titleFilter = z.object({
  include: z.array(z.string()).default(DEFAULT_INCLUDE),
  exclude: z.array(z.string()).default(DEFAULT_EXCLUDE),
});

const agent = z.object({
  max_steps: z.number().int().min(1).default(600),
  max_wall_clock_min: z.number().min(1).default(120),
  max_consecutive_tool_errors: z.number().int().min(1).default(3),
  context_chars: z.number().int().min(10_000).default(160_000),
});

const http = z.object({
  min_interval_ms: z.number().int().min(0).default(1000),
  max_requests_per_host_per_run: z.number().int().min(1).default(300),
  max_retries: z.number().int().min(0).default(2),
  max_retry_after_s: z.number().min(0).default(60),
  timeout_s: z.number().min(1).default(30),
});

export const fileConfigSchema = z.object({
  companies: z.array(company).min(1),
  preferences: z.string().default(""),
  match_threshold: z.number().int().min(0).max(100).default(70),
  ghost_threshold_days: z.number().int().min(1).default(60),
  job_retention_days: z.number().int().min(1).default(90),
  title_filter: titleFilter.prefault({}),
  agent: agent.prefault({}),
  http: http.prefault({}),
});

export const envSchema = z.object({
  LLM_BASE_URL: z.url(),
  LLM_MODEL: z.string().min(1),
  LLM_API_KEY: z.string().min(1),
  MYJOBBOT_DATA_DIR: z.string().min(1).default("data"),
});

export type FileConfig = z.infer<typeof fileConfigSchema>;
export type Env = z.infer<typeof envSchema>;
```

`src/config/load.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { envSchema, fileConfigSchema, type Env, type FileConfig } from "./schema.js";

export interface AppConfig {
  env: Env;
  file: FileConfig;
  resume: string;
  dataDir: string;
}

export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const env = envSchema.parse(environment);
  const dataDir = env.MYJOBBOT_DATA_DIR;
  const file = fileConfigSchema.parse(parse(readText(dataDir, "config.yaml")));
  return { env, file, resume: readText(dataDir, "resume.md"), dataDir };
}

function readText(dir: string, name: string): string {
  return readFileSync(join(dir, name), "utf8");
}
```

`src/errors.ts`:

```ts
import { z } from "zod";

export function describeError(error: unknown): string {
  if (error instanceof z.ZodError) return z.prettifyError(error);
  if (error instanceof Error) return error.message;
  return String(error);
}
```

`src/app/run.ts`:

```ts
import { loadConfig } from "../config/load.js";

export async function runOnce(environment: NodeJS.ProcessEnv): Promise<string> {
  const config = loadConfig(environment);
  return `loaded ${config.file.companies.length} companies`;
}
```

`src/cli.ts` (full file):

```ts
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { runOnce } from "./app/run.js";
import { describeError } from "./errors.js";

const USAGE = "usage: myjobbot run";

async function main(argv: string[]): Promise<number> {
  const { positionals } = parseArgs({ args: argv, allowPositionals: true });
  if (positionals[0] !== "run") {
    console.error(USAGE);
    return 2;
  }
  if (existsSync(".env")) process.loadEnvFile(".env");
  console.log(await runOnce(process.env));
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(`myjobbot: ${describeError(error)}`);
    process.exitCode = 1;
  },
);
```

- [ ] **Step 5: Add examples and ignore local data**

`examples/config.yaml`:

```yaml
companies:
  - { name: Stripe, ats: greenhouse, slug: stripe }
  - { name: Palantir, ats: lever, slug: palantir }
  - { name: OpenAI, ats: ashby, slug: openai }
preferences: |
  Senior or staff backend / platform roles. Remote (US) preferred.
match_threshold: 70
```

`examples/resume.md`:

```markdown
# Example Engineer

Senior software engineer, 8 years. Backend services in Go and TypeScript,
PostgreSQL, Kubernetes, AWS. Led a payments platform migration.
```

`.env.example`:

```
LLM_BASE_URL=http://llm.home.arpa:8081/v1
LLM_MODEL=qwen3-coder-30b
LLM_API_KEY=replace-me
MYJOBBOT_DATA_DIR=data
```

Append `data/` to `.gitignore`.

- [ ] **Step 6: Verify**

Run: `npm run check`
Expected: all tests pass and habit-hooks is clean.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/ tests/ examples/ .env.example .gitignore
git commit -m "Load and validate config.yaml, resume and env"
```

---

### Task 3: Agent loop skeleton with the `finish` tool, wired to `run`

This is the walking skeleton: a real model call path from `myjobbot run` through the loop to a tool. Steps 2–9 add modules before Step 10 wires them, so transient `unused-file` / `test-only-dead-code` reports are expected until Step 10.

**Files:**
- Create: `src/tools/tool.ts`, `src/tools/dispatch.ts`, `src/tools/context.ts`, `src/tools/finish.ts`, `src/tools/registry.ts`, `src/agent/budget.ts`, `src/agent/llm.ts`, `src/agent/trace.ts`, `src/agent/prompt.ts`, `src/agent/loop.ts`
- Modify: `src/app/run.ts`, `src/cli.ts`
- Create: `tests/helpers/config.ts`, `tests/helpers/context.ts`, `tests/helpers/chat.ts`, `tests/helpers/agent.ts`, `tests/dispatch.test.ts`, `tests/budget.test.ts`, `tests/agent-loop.test.ts`, `tests/run.test.ts`

- [ ] **Step 1: Install the OpenAI SDK**

```bash
npm install --save-exact openai@7.27.0
```

- [ ] **Step 2: Write the failing dispatch tests**

`tests/dispatch.test.ts`:

```ts
import { expect, test } from "vitest";
import { z } from "zod";
import { dispatch } from "../src/tools/dispatch.js";
import { defineTool } from "../src/tools/tool.js";

const echo = defineTool({
  name: "echo",
  description: "Echo text back",
  schema: z.object({ text: z.string() }),
  run: ({ text }) => ({ text }),
});

test("defineTool exposes the input JSON Schema without $schema", () => {
  expect(echo.parameters).toEqual({
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  });
});

test("dispatch returns the tool result as JSON", async () => {
  const outcome = await dispatch([echo], { name: "echo", arguments: '{"text":"hi"}' });
  expect(outcome).toEqual({ ok: true, content: '{"text":"hi"}' });
});

test("dispatch reports invalid arguments", async () => {
  const outcome = await dispatch([echo], { name: "echo", arguments: '{"text":5}' });
  expect(outcome.ok).toBe(false);
  expect(outcome.content).toContain("expected string");
});

test("dispatch reports malformed JSON", async () => {
  const outcome = await dispatch([echo], { name: "echo", arguments: "{not json" });
  expect(outcome.ok).toBe(false);
  expect(outcome.content).toContain("error");
});

test("dispatch reports an unknown tool and lists the real ones", async () => {
  const outcome = await dispatch([echo], { name: "nope", arguments: "{}" });
  expect(outcome.ok).toBe(false);
  expect(outcome.content).toContain('unknown tool \\"nope\\"; available: echo');
});

test("dispatch treats empty arguments as an empty object", async () => {
  const ping = defineTool({ name: "ping", description: "Ping", schema: z.object({}), run: () => "pong" });
  expect(await dispatch([ping], { name: "ping", arguments: "" })).toEqual({ ok: true, content: '"pong"' });
});
```

(`content` is a JSON string, so the quotes around `nope` appear escaped as `\"nope\"`.)

- [ ] **Step 3: Write the failing budget tests**

`tests/budget.test.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. `src/tools/dispatch.js`, `src/tools/tool.js` and `src/agent/budget.js` cannot be resolved.

- [ ] **Step 5: Implement tool definition, dispatch and budget**

`src/tools/tool.ts`:

```ts
import { z } from "zod";

interface ToolSpec<S extends z.ZodType> {
  name: string;
  description: string;
  schema: S;
  run(args: z.infer<S>): unknown;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  invoke(raw: unknown): Promise<unknown>;
}

export function defineTool<S extends z.ZodType>(spec: ToolSpec<S>): Tool {
  const { $schema: _schema, ...parameters } = z.toJSONSchema(spec.schema, { io: "input" });
  return {
    name: spec.name,
    description: spec.description,
    parameters,
    invoke: async (raw) => spec.run(spec.schema.parse(raw)),
  };
}
```

`src/tools/dispatch.ts`:

```ts
import { describeError } from "../errors.js";
import type { Tool } from "./tool.js";

interface ToolCallRequest {
  name: string;
  arguments: string;
}

interface ToolOutcome {
  ok: boolean;
  content: string;
}

export async function dispatch(tools: Tool[], call: ToolCallRequest): Promise<ToolOutcome> {
  const tool = tools.find((candidate) => candidate.name === call.name);
  if (!tool) return failure(`unknown tool "${call.name}"; available: ${tools.map((t) => t.name).join(", ")}`);
  try {
    const result = await tool.invoke(parseArguments(call.arguments));
    return { ok: true, content: JSON.stringify(result ?? null) };
  } catch (error) {
    return failure(describeError(error));
  }
}

function parseArguments(raw: string): unknown {
  return raw.trim() === "" ? {} : JSON.parse(raw);
}

function failure(message: string): ToolOutcome {
  return { ok: false, content: JSON.stringify({ error: message }) };
}
```

`src/agent/budget.ts`:

```ts
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
```

`io: "input"` matters: it describes what the model may send, so fields with defaults (like `reasons`) are optional. The default output mode would mark them required, and it throws on schemas containing transforms.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- dispatch budget`
Expected: PASS (9 tests).

- [ ] **Step 7: Write the failing agent-loop tests and their helpers**

`tests/helpers/config.ts`:

```ts
import { fileConfigSchema, type FileConfig } from "../../src/config/schema.js";

export function testFileConfig(overrides: Record<string, unknown> = {}): FileConfig {
  return fileConfigSchema.parse({
    companies: [{ name: "Stripe", ats: "greenhouse", slug: "stripe" }],
    ...overrides,
  });
}
```

`tests/helpers/context.ts`:

```ts
import { newRunState, type ToolContext } from "../../src/tools/context.js";
import { testFileConfig } from "./config.js";

export function testContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return { config: testFileConfig(), run: newRunState(), ...overrides };
}
```

`tests/helpers/chat.ts`:

```ts
import type { AssistantMessage, ChatFn, Message } from "../../src/agent/llm.js";

export function toolCallsReply(...calls: Array<[string, object]>): AssistantMessage {
  return {
    role: "assistant",
    content: null,
    refusal: null,
    tool_calls: calls.map(([name, args], index) => ({
      id: `call_${index}`,
      type: "function" as const,
      function: { name, arguments: JSON.stringify(args) },
    })),
  };
}

export function toolCallReply(name: string, args: object): AssistantMessage {
  return toolCallsReply([name, args]);
}

export function textReply(content: string): AssistantMessage {
  return { role: "assistant", content, refusal: null };
}

export function scriptedChat(replies: AssistantMessage[]): { chat: ChatFn; requests: Message[][] } {
  const requests: Message[][] = [];
  const queue = [...replies];
  const chat: ChatFn = async (messages) => {
    requests.push(structuredClone(messages));
    const reply = queue.shift();
    if (!reply) throw new Error("scripted chat ran out of replies");
    return reply;
  };
  return { chat, requests };
}
```

`tests/helpers/agent.ts`:

```ts
import type { AssistantMessage, Message } from "../../src/agent/llm.js";
import { runAgent, type AgentDeps, type AgentResult } from "../../src/agent/loop.js";
import type { Trace, TraceEvent } from "../../src/agent/trace.js";
import type { ToolContext } from "../../src/tools/context.js";
import { buildTools } from "../../src/tools/registry.js";
import { scriptedChat } from "./chat.js";
import { testContext } from "./context.js";

export const TEST_LIMITS = { max_steps: 10, max_wall_clock_min: 5, max_consecutive_tool_errors: 3, context_chars: 160_000 };

interface Harness {
  result: AgentResult;
  context: ToolContext;
  requests: Message[][];
  events: TraceEvent[];
}

export async function runScripted(
  replies: AssistantMessage[],
  overrides: Partial<AgentDeps> = {},
  context = testContext(),
): Promise<Harness> {
  const { chat, requests } = scriptedChat(replies);
  const trace = memoryTrace();
  const deps = { ...baseDeps(context), chat, trace, ...overrides };
  const result = await runAgent(deps, [{ role: "system", content: "test" }, { role: "user", content: "go" }]);
  return { result, context, requests, events: trace.events };
}

function baseDeps(context: ToolContext): Omit<AgentDeps, "chat" | "trace"> {
  return { tools: buildTools(context), limits: TEST_LIMITS, clock: () => 0, isFinished: () => context.run.finished };
}

function memoryTrace(): Trace & { events: TraceEvent[] } {
  const events: TraceEvent[] = [];
  return {
    events,
    write: (event) => {
      events.push(event);
    },
  };
}
```

`tests/agent-loop.test.ts`:

```ts
import { expect, test } from "vitest";
import { runScripted, TEST_LIMITS } from "./helpers/agent.js";
import { textReply, toolCallReply } from "./helpers/chat.js";

const FINISH = toolCallReply("finish", { summary: "all done" });

test("agent finishes when the model calls finish", async () => {
  const { result, context } = await runScripted([FINISH]);
  expect(result).toEqual({ status: "finished", reason: "finish called", steps: 1 });
  expect(context.run.summary).toBe("all done");
});

test("agent feeds invalid tool arguments back to the model", async () => {
  const { result, requests } = await runScripted([toolCallReply("finish", {}), FINISH]);
  expect(result.status).toBe("finished");
  expect(requests[1]?.at(-1)).toMatchObject({ role: "tool", tool_call_id: "call_0" });
  expect(JSON.stringify(requests[1]?.at(-1))).toContain("error");
});

test("agent nudges a reply that has no tool calls", async () => {
  const { result, requests } = await runScripted([textReply("Sure, starting now."), FINISH]);
  expect(result.steps).toBe(2);
  expect(requests[1]?.at(-1)).toMatchObject({ role: "user", content: expect.stringContaining("tool calls") });
});

test("agent aborts after consecutive tool errors", async () => {
  const bad = toolCallReply("nope", {});
  const { result } = await runScripted([bad, bad, bad]);
  expect(result).toEqual({ status: "aborted", reason: "3 consecutive tool errors", steps: 3 });
});

test("agent aborts at the step limit", async () => {
  const limits = { ...TEST_LIMITS, max_steps: 2 };
  const { result } = await runScripted([textReply("a"), textReply("b")], { limits });
  expect(result).toEqual({ status: "aborted", reason: "step limit of 2 reached", steps: 2 });
});

test("agent traces the start and end of a run", async () => {
  const { events } = await runScripted([FINISH]);
  expect(events[0]).toMatchObject({ type: "start" });
  expect(events.at(-1)).toEqual({ type: "end", status: "finished", reason: "finish called", steps: 1 });
});
```

- [ ] **Step 8: Run tests to verify they fail**

Run: `npm test -- agent-loop`
Expected: FAIL. `src/agent/llm.js`, `src/agent/loop.js`, `src/agent/trace.js`, `src/tools/context.js` and `src/tools/registry.js` cannot be resolved.

- [ ] **Step 9: Implement context, finish tool, registry, LLM client, trace and loop**

`src/tools/context.ts`:

```ts
import type { FileConfig } from "../config/schema.js";

interface RunState {
  finished: boolean;
  summary: string | null;
}

export interface ToolContext {
  config: FileConfig;
  run: RunState;
}

export function newRunState(): RunState {
  return { finished: false, summary: null };
}
```

`src/tools/finish.ts`:

```ts
import { z } from "zod";
import type { ToolContext } from "./context.js";
import { defineTool, type Tool } from "./tool.js";

const schema = z.object({
  summary: z.string().min(1).describe("One paragraph: companies searched, jobs scored, notable matches."),
});

export function finishTool(context: ToolContext): Tool {
  return defineTool({
    name: "finish",
    description: "End the run. Call only when every company has total_unscored 0.",
    schema,
    run: ({ summary }) => {
      context.run.finished = true;
      context.run.summary = summary;
      return { ok: true };
    },
  });
}
```

`src/tools/registry.ts`:

```ts
import type { ToolContext } from "./context.js";
import { finishTool } from "./finish.js";
import type { Tool } from "./tool.js";

export function buildTools(context: ToolContext): Tool[] {
  return [finishTool(context)];
}
```

`src/agent/llm.ts`:

```ts
import OpenAI from "openai";
import type { Env } from "../config/schema.js";
import type { Tool } from "../tools/tool.js";

export type Message = OpenAI.Chat.ChatCompletionMessageParam;
export type AssistantMessage = OpenAI.Chat.ChatCompletionMessage;
export type ChatFn = (messages: Message[], tools: Tool[]) => Promise<AssistantMessage>;

export function createChat(env: Env): ChatFn {
  const client = new OpenAI({ baseURL: env.LLM_BASE_URL, apiKey: env.LLM_API_KEY });
  return async (messages, tools) => {
    const completion = await client.chat.completions.create({
      model: env.LLM_MODEL,
      messages,
      tools: tools.map(toFunctionTool),
    });
    return firstMessage(completion);
  };
}

export function toHistory(reply: AssistantMessage): Message {
  return { role: "assistant", content: reply.content, tool_calls: reply.tool_calls };
}

function toFunctionTool(tool: Tool): OpenAI.Chat.ChatCompletionFunctionTool {
  return { type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } };
}

function firstMessage(completion: OpenAI.Chat.ChatCompletion): AssistantMessage {
  const choice = completion.choices[0];
  if (!choice) throw new Error("LLM returned no choices");
  return choice.message;
}
```

`src/agent/trace.ts`:

```ts
import { appendFileSync } from "node:fs";

export type TraceEvent = Record<string, unknown>;

export interface Trace {
  write(event: TraceEvent): void;
}

export function fileTrace(path: string): Trace {
  return {
    write: (event) => appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`),
  };
}
```

`src/agent/loop.ts`:

```ts
import type { FileConfig } from "../config/schema.js";
import { dispatch } from "../tools/dispatch.js";
import type { Tool } from "../tools/tool.js";
import { Budget } from "./budget.js";
import { toHistory, type AssistantMessage, type ChatFn, type Message } from "./llm.js";
import type { Trace, TraceEvent } from "./trace.js";

export interface AgentDeps {
  chat: ChatFn;
  tools: Tool[];
  limits: FileConfig["agent"];
  trace: Trace;
  clock: () => number;
  isFinished: () => boolean;
}

export interface AgentResult {
  status: "finished" | "aborted";
  reason: string;
  steps: number;
}

type FunctionCall = Extract<NonNullable<AssistantMessage["tool_calls"]>[number], { type: "function" }>;

const NUDGE = "Respond only with tool calls. Call finish when every company has total_unscored 0.";

export async function runAgent(deps: AgentDeps, messages: Message[]): Promise<AgentResult> {
  return new AgentSession(deps, messages).run();
}

class AgentSession {
  private readonly budget: Budget;

  constructor(
    private readonly deps: AgentDeps,
    private readonly messages: Message[],
  ) {
    this.budget = new Budget(deps.limits, deps.clock);
  }

  async run(): Promise<AgentResult> {
    this.deps.trace.write({ type: "start", messages: this.messages });
    while (!this.deps.isFinished()) {
      const exhausted = this.budget.exhaustedReason();
      if (exhausted) return this.end("aborted", exhausted);
      await this.step();
    }
    return this.end("finished", "finish called");
  }

  private async step(): Promise<void> {
    this.budget.countStep();
    const reply = await this.deps.chat(this.messages, this.deps.tools);
    this.record({ type: "assistant", content: reply.content, tool_calls: reply.tool_calls }, toHistory(reply));
    const calls = functionCalls(reply);
    if (calls.length === 0) return this.nudge();
    for (const call of calls) await this.execute(call);
  }

  private async execute(call: FunctionCall): Promise<void> {
    const outcome = await dispatch(this.deps.tools, call.function);
    this.budget.recordOutcome(outcome.ok);
    this.record(
      { type: "tool", name: call.function.name, ok: outcome.ok, content: outcome.content },
      { role: "tool", tool_call_id: call.id, content: outcome.content },
    );
  }

  private nudge(): void {
    this.budget.recordOutcome(false);
    this.record({ type: "nudge" }, { role: "user", content: NUDGE });
  }

  private record(event: TraceEvent, message: Message): void {
    this.deps.trace.write(event);
    this.messages.push(message);
  }

  private end(status: AgentResult["status"], reason: string): AgentResult {
    const result = { status, reason, steps: this.budget.steps };
    this.deps.trace.write({ type: "end", ...result });
    return result;
  }
}

function functionCalls(reply: AssistantMessage): FunctionCall[] {
  return (reply.tool_calls ?? []).filter((call): call is FunctionCall => call.type === "function");
}
```

- [ ] **Step 10: Write the failing end-to-end `run` test**

`tests/run.test.ts`:

```ts
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { runOnce } from "../src/app/run.js";
import { scriptedChat, toolCallReply } from "./helpers/chat.js";
import { makeDataDir, TEST_ENV } from "./helpers/dataDir.js";

test("runOnce finishes when the model calls finish and writes a trace", async () => {
  const dataDir = makeDataDir();
  const { chat } = scriptedChat([toolCallReply("finish", { summary: "nothing to do" })]);
  const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat });
  expect(report).toMatchObject({ status: "finished", steps: 1, summary: "nothing to do" });
  expect(readdirSync(join(dataDir, "runs"))).toHaveLength(1);
});
```

Run: `npm test -- run.test`
Expected: FAIL. `runOnce` returns a string and ignores the second argument.

- [ ] **Step 11: Implement the prompt and wire everything into `run`**

`src/agent/prompt.ts`:

```ts
import type { AppConfig } from "../config/load.js";
import type { Message } from "./llm.js";

const SYSTEM_PROMPT = `You are myjobbot, an autonomous agent that finds software engineering jobs that fit the user's resume.

Work only through tool calls:
1. Call list_companies.
2. For each company call fetch_jobs. It returns up to 25 unscored jobs and total_unscored.
3. Score every returned job from 0 to 100 for fit, then save the whole page with one record_matches call.
4. Call fetch_jobs again for the same company until total_unscored is 0, then move on to the next company.
5. When every company is done, call finish with a one-paragraph summary.

Scoring rules:
- You only have job metadata (title, location, department, team, workplace type, remote flag, compensation, days open). Full descriptions are not available yet, so judge from metadata.
- Weigh seniority, specialty and location or remote fit against the resume and the user's preferences.
- Jobs scoring {threshold} or more are shown to the user. For scores below 40, leave reasons and gaps empty.
- possible_ghost=true means the posting has been open unusually long; lower its score slightly.
- Copy job_id values exactly.

User preferences:
{preferences}`;

export function initialMessages(config: AppConfig): Message[] {
  return [
    { role: "system", content: systemPrompt(config) },
    { role: "user", content: `My resume:\n\n${config.resume}\n\nFind and score new jobs for me now.` },
  ];
}

function systemPrompt(config: AppConfig): string {
  const preferences = config.file.preferences.trim() || "(none given)";
  return SYSTEM_PROMPT.replace("{threshold}", String(config.file.match_threshold)).replace("{preferences}", preferences);
}
```

`src/app/run.ts` (full file):

```ts
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createChat, type ChatFn } from "../agent/llm.js";
import { runAgent, type AgentDeps, type AgentResult } from "../agent/loop.js";
import { initialMessages } from "../agent/prompt.js";
import { fileTrace, type Trace } from "../agent/trace.js";
import { loadConfig, type AppConfig } from "../config/load.js";
import { newRunState, type ToolContext } from "../tools/context.js";
import { buildTools } from "../tools/registry.js";

interface RunSeams {
  chat?: ChatFn;
}

interface RunReport extends AgentResult {
  summary: string | null;
}

export async function runOnce(environment: NodeJS.ProcessEnv, seams: RunSeams = {}): Promise<RunReport> {
  const config = loadConfig(environment);
  const context = buildContext(config);
  const result = await runAgent(agentDeps(config, context, seams), initialMessages(config));
  return { ...result, summary: context.run.summary };
}

function buildContext(config: AppConfig): ToolContext {
  return { config: config.file, run: newRunState() };
}

function agentDeps(config: AppConfig, context: ToolContext, seams: RunSeams): AgentDeps {
  return {
    chat: seams.chat ?? createChat(config.env),
    tools: buildTools(context),
    limits: config.file.agent,
    trace: openTrace(config.dataDir),
    clock: Date.now,
    isFinished: () => context.run.finished,
  };
}

function openTrace(dataDir: string): Trace {
  const runsDir = join(dataDir, "runs");
  mkdirSync(runsDir, { recursive: true });
  return fileTrace(join(runsDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`));
}
```

In `src/cli.ts`, replace the body of `main` after the usage check with:

```ts
  if (existsSync(".env")) process.loadEnvFile(".env");
  const report = await runOnce(process.env);
  console.log(`run ${report.status} after ${report.steps} steps: ${report.reason}`);
  if (report.summary) console.log(report.summary);
  return report.status === "finished" ? 0 : 1;
```

`main` is now exactly 12 lines. Keep it that way.

- [ ] **Step 12: Verify**

Run: `npm run check`
Expected: all tests pass, typecheck clean, habit-hooks clean (the transient findings from Steps 2–9 are gone).

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json src/ tests/
git commit -m "Add agent loop skeleton with finish tool and run wiring"
```

---

### Task 4: `list_companies` tool

**Files:**
- Create: `src/tools/listCompanies.ts`, `tests/helpers/tools.ts`, `tests/listCompanies.test.ts`
- Modify: `src/tools/registry.ts`

- [ ] **Step 1: Write the failing test**

`tests/helpers/tools.ts`:

```ts
import type { ToolContext } from "../../src/tools/context.js";
import { buildTools } from "../../src/tools/registry.js";

export async function invokeTool(context: ToolContext, name: string, args: unknown): Promise<unknown> {
  const tool = buildTools(context).find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`no tool named ${name}`);
  return tool.invoke(args);
}
```

`tests/listCompanies.test.ts`:

```ts
import { expect, test } from "vitest";
import { testContext } from "./helpers/context.js";
import { invokeTool } from "./helpers/tools.js";

test("list_companies returns each company's name and board type", async () => {
  const result = await invokeTool(testContext(), "list_companies", {});
  expect(result).toEqual([{ name: "Stripe", ats: "greenhouse" }]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- listCompanies`
Expected: FAIL with `no tool named list_companies`.

- [ ] **Step 3: Implement and register**

`src/tools/listCompanies.ts`:

```ts
import { z } from "zod";
import type { ToolContext } from "./context.js";
import { defineTool, type Tool } from "./tool.js";

export function listCompaniesTool(context: ToolContext): Tool {
  return defineTool({
    name: "list_companies",
    description: "List the companies whose job boards you can search.",
    schema: z.object({}),
    run: () => context.config.companies.map(({ name, ats }) => ({ name, ats })),
  });
}
```

`src/tools/registry.ts`:

```ts
import type { ToolContext } from "./context.js";
import { finishTool } from "./finish.js";
import { listCompaniesTool } from "./listCompanies.js";
import type { Tool } from "./tool.js";

export function buildTools(context: ToolContext): Tool[] {
  return [listCompaniesTool(context), finishTool(context)];
}
```

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: all pass, habit-hooks clean.

- [ ] **Step 5: Commit**

```bash
git add src/tools/ tests/
git commit -m "Add list_companies tool"
```

---

### Task 5: `fetch_jobs` for Greenhouse, end to end

A vertical slice: job model, title filter, SQLite store, basic HTTP client, Greenhouse adapter, and the tool, all wired into `run`. Transient findings are expected until Step 12.

**Files:**
- Modify: `src/jobs/job.ts`, `src/tools/context.ts`, `src/tools/registry.ts`, `src/app/run.ts`, `tests/helpers/context.ts`
- Create: `src/jobs/normalize.ts`, `src/jobs/titleFilter.ts`, `src/db/open.ts`, `src/db/jobStore.ts`, `src/http/client.ts`, `src/sources/types.ts`, `src/sources/fields.ts`, `src/sources/greenhouse.ts`, `src/sources/index.ts`, `src/tools/jobSummary.ts`, `src/tools/fetchJobs.ts`
- Create: `tests/fixtures/greenhouse.json`, `tests/helpers/fixtures.ts`, `tests/helpers/http.ts`, `tests/helpers/boards.ts`, `tests/normalize.test.ts`, `tests/titleFilter.test.ts`, `tests/sources.test.ts`, `tests/jobStore.test.ts`, `tests/httpClient.test.ts`, `tests/fetchJobs.test.ts`

- [ ] **Step 1: Write failing tests for title normalization and filtering**

`tests/normalize.test.ts`:

```ts
import { expect, test } from "vitest";
import { normalizeTitle } from "../src/jobs/normalize.js";

test("normalizeTitle lowercases and strips punctuation", () => {
  expect(normalizeTitle("Sr. Software Engineer, Backend")).toBe("sr software engineer backend");
});

test("normalizeTitle collapses whitespace", () => {
  expect(normalizeTitle("  Staff   Engineer  ")).toBe("staff engineer");
});
```

`tests/titleFilter.test.ts`:

```ts
import { expect, test } from "vitest";
import { passesTitleFilter } from "../src/jobs/titleFilter.js";

const FILTER = { include: ["engineer", "developer", "sre"], exclude: ["manager", "intern"] };

test("title filter accepts included titles", () => {
  expect(passesTitleFilter("Senior Software Engineer", FILTER)).toBe(true);
  expect(passesTitleFilter("SRE, Storage", FILTER)).toBe(true);
});

test("title filter matches word prefixes, not inner substrings", () => {
  expect(passesTitleFilter("Engineering Lead", FILTER)).toBe(true);
  expect(passesTitleFilter("Presales Consultant", FILTER)).toBe(false);
});

test("title filter rejects excluded titles", () => {
  expect(passesTitleFilter("Engineering Manager", FILTER)).toBe(false);
  expect(passesTitleFilter("Software Engineer Intern", FILTER)).toBe(false);
});

test("title filter rejects titles with no included term", () => {
  expect(passesTitleFilter("Account Executive", FILTER)).toBe(false);
});
```

- [ ] **Step 2: Implement normalization and filtering**

`src/jobs/normalize.ts`:

```ts
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
```

`src/jobs/titleFilter.ts`:

```ts
import type { FileConfig } from "../config/schema.js";
import { normalizeTitle } from "./normalize.js";

export function passesTitleFilter(title: string, filter: FileConfig["title_filter"]): boolean {
  const normalized = normalizeTitle(title);
  const mentions = (term: string): boolean => new RegExp(`\\b${normalizeTitle(term)}`).test(normalized);
  return filter.include.some(mentions) && !filter.exclude.some(mentions);
}
```

`normalizeTitle` leaves only `[a-z0-9 ]`, so the interpolated term never contains regex metacharacters.

Run: `npm test -- normalize titleFilter`
Expected: PASS (6 tests).

- [ ] **Step 3: Write the failing Greenhouse adapter test**

`tests/fixtures/greenhouse.json`:

```json
{
  "jobs": [
    {
      "id": 8172503,
      "title": "Backend Engineer, Payments",
      "absolute_url": "https://stripe.com/jobs/search?gh_jid=8172503",
      "location": { "name": "Remote from the US" },
      "first_published": "2026-09-09T10:52:09-04:00",
      "updated_at": "2026-09-25T16:45:00-04:00",
      "company_name": "Stripe"
    },
    {
      "id": 8172504,
      "title": "Account Executive",
      "absolute_url": "https://stripe.com/jobs/search?gh_jid=8172504",
      "location": null,
      "first_published": null,
      "company_name": "Stripe"
    }
  ],
  "meta": { "total": 2 }
}
```

`tests/helpers/fixtures.ts`:

```ts
import { readFileSync } from "node:fs";

export function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
}
```

`tests/helpers/http.ts`:

```ts
import type { JsonGetter } from "../../src/http/client.js";

export function fakeBoard(body: unknown): JsonGetter & { urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    getJson: async (url) => {
      urls.push(url);
      return structuredClone(body);
    },
  };
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

export function scriptedFetch(responses: Response[]) {
  const urls: string[] = [];
  const queue = [...responses];
  const fetchFn = async (url: string): Promise<Response> => {
    urls.push(url);
    const response = queue.shift();
    if (!response) throw new Error("scripted fetch ran out of responses");
    return response;
  };
  return { fetchFn, urls };
}
```

`tests/sources.test.ts`:

```ts
import { expect, test } from "vitest";
import { fetcherFor } from "../src/sources/index.js";
import { loadFixture } from "./helpers/fixtures.js";
import { fakeBoard } from "./helpers/http.js";

const CASES = [
  {
    ats: "greenhouse" as const,
    slug: "stripe",
    url: "https://boards-api.greenhouse.io/v1/boards/stripe/jobs",
    count: 2,
    first: {
      jobId: "8172503",
      title: "Backend Engineer, Payments",
      url: "https://stripe.com/jobs/search?gh_jid=8172503",
      location: "Remote from the US",
      postedAt: "2026-09-09T14:52:09.000Z",
    },
  },
];

test.each(CASES)("$ats adapter requests the board and normalizes postings", async (example) => {
  const http = fakeBoard(loadFixture(`${example.ats}.json`));
  const jobs = await fetcherFor(example.ats)({ name: "Acme", slug: example.slug }, http);
  expect(http.urls).toEqual([example.url]);
  expect(jobs).toHaveLength(example.count);
  expect(jobs[0]).toMatchObject({ ats: example.ats, company: "Acme", ...example.first });
});

test("greenhouse adapter maps missing optional fields to null", async () => {
  const jobs = await fetcherFor("greenhouse")({ name: "Acme", slug: "stripe" }, fakeBoard(loadFixture("greenhouse.json")));
  expect(jobs[1]).toMatchObject({ location: null, postedAt: null, description: null });
});
```

Run: `npm test -- sources`
Expected: FAIL. `src/sources/index.js` cannot be resolved.

- [ ] **Step 4: Implement the job model and Greenhouse adapter**

`src/jobs/job.ts` (full file):

```ts
export const ATS_NAMES = ["greenhouse", "lever", "ashby"] as const;
export type Ats = (typeof ATS_NAMES)[number];

const MAX_DESCRIPTION_CHARS = 20_000;

export interface Job {
  ats: Ats;
  jobId: string;
  company: string;
  title: string;
  url: string;
  location: string | null;
  department: string | null;
  team: string | null;
  workplaceType: string | null;
  isRemote: boolean | null;
  compensation: string | null;
  postedAt: string | null;
  description: string | null;
}

type JobCore = Pick<Job, "ats" | "jobId" | "company" | "title" | "url">;
type JobDetails = Omit<Job, keyof JobCore>;

const NO_DETAILS: JobDetails = {
  location: null,
  department: null,
  team: null,
  workplaceType: null,
  isRemote: null,
  compensation: null,
  postedAt: null,
  description: null,
};

export function makeJob(core: JobCore, details: Partial<JobDetails>): Job {
  const description = details.description?.slice(0, MAX_DESCRIPTION_CHARS) ?? null;
  return { ...NO_DETAILS, ...details, ...core, description };
}
```

`src/sources/types.ts`:

```ts
import type { JsonGetter } from "../http/client.js";
import type { Job } from "../jobs/job.js";

export interface BoardRef {
  name: string;
  slug: string;
}

export type BoardFetcher = (board: BoardRef, http: JsonGetter) => Promise<Job[]>;
```

`src/sources/fields.ts`:

```ts
import { z } from "zod";

export const optionalText = z.string().nullish().transform((value) => value ?? null);
export const optionalDate = z.union([z.string(), z.number()]).nullish().transform(toIsoOrNull);

function toIsoOrNull(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}
```

`src/sources/greenhouse.ts`:

```ts
import { z } from "zod";
import type { JsonGetter } from "../http/client.js";
import { makeJob, type Job } from "../jobs/job.js";
import { optionalDate, optionalText } from "./fields.js";
import type { BoardRef } from "./types.js";

const posting = z.object({
  id: z.number(),
  title: z.string(),
  absolute_url: z.string(),
  location: z.object({ name: optionalText }).nullish(),
  first_published: optionalDate,
});
const board = z.object({ jobs: z.array(posting) });

export async function fetchGreenhouse(ref: BoardRef, http: JsonGetter): Promise<Job[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(ref.slug)}/jobs`;
  const { jobs } = board.parse(await http.getJson(url));
  return jobs.map((post) => toJob(ref.name, post));
}

function toJob(company: string, post: z.infer<typeof posting>): Job {
  return makeJob(
    { ats: "greenhouse", jobId: String(post.id), company, title: post.title, url: post.absolute_url },
    { location: post.location?.name ?? null, postedAt: post.first_published },
  );
}
```

`src/sources/index.ts`:

```ts
import type { Ats } from "../jobs/job.js";
import { fetchGreenhouse } from "./greenhouse.js";
import type { BoardFetcher } from "./types.js";

const notYetSupported: BoardFetcher = async (board) => {
  throw new Error(`${board.name}: this board type is not supported yet`);
};

const FETCHERS: Record<Ats, BoardFetcher> = {
  greenhouse: fetchGreenhouse,
  lever: notYetSupported,
  ashby: notYetSupported,
};

export function fetcherFor(ats: Ats): BoardFetcher {
  return FETCHERS[ats];
}
```

`src/http/client.ts` (basic version; Task 7 adds rate limiting and retries):

```ts
import type { FileConfig } from "../config/schema.js";

const MS_PER_SECOND = 1000;

export interface JsonGetter {
  getJson(url: string): Promise<unknown>;
}

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export class HttpClient implements JsonGetter {
  constructor(
    private readonly config: FileConfig["http"],
    private readonly fetchFn: FetchFn,
  ) {}

  async getJson(url: string): Promise<unknown> {
    const signal = AbortSignal.timeout(this.config.timeout_s * MS_PER_SECOND);
    const response = await this.fetchFn(url, { signal });
    if (!response.ok) throw new Error(`GET ${url} failed with HTTP ${response.status}`);
    return response.json();
  }
}
```

Run: `npm test -- sources`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing HTTP client tests**

`tests/httpClient.test.ts`:

```ts
import { expect, test } from "vitest";
import { HttpClient } from "../src/http/client.js";
import { testFileConfig } from "./helpers/config.js";
import { jsonResponse, scriptedFetch } from "./helpers/http.js";

test("HttpClient returns parsed JSON", async () => {
  const { fetchFn } = scriptedFetch([jsonResponse({ jobs: [] })]);
  const client = new HttpClient(testFileConfig().http, fetchFn);
  expect(await client.getJson("https://example.com/board")).toEqual({ jobs: [] });
});

test("HttpClient throws on a non-2xx response", async () => {
  const { fetchFn } = scriptedFetch([jsonResponse({}, 404)]);
  const client = new HttpClient(testFileConfig().http, fetchFn);
  await expect(client.getJson("https://example.com/board")).rejects.toThrow("HTTP 404");
});
```

Run: `npm test -- httpClient`
Expected: PASS. The client already exists from Step 4; these tests lock in its behavior before Task 7 changes it.

- [ ] **Step 6: Write the failing store tests**

`tests/jobStore.test.ts`:

```ts
import { expect, test } from "vitest";
import { JobStore } from "../src/db/jobStore.js";
import { openDatabase } from "../src/db/open.js";
import { makeJob } from "../src/jobs/job.js";

const DAY_ONE = "2026-10-01T00:00:00.000Z";
const DAY_TWO = "2026-10-02T00:00:00.000Z";

function sampleJob(jobId: string, title = "Backend Engineer") {
  return makeJob({ ats: "greenhouse", jobId, company: "Stripe", title, url: `https://example.com/${jobId}` }, {});
}

test("upsertAll keeps first_seen and advances last_seen", () => {
  const store = new JobStore(openDatabase(":memory:"));
  store.upsertAll([sampleJob("1")], DAY_ONE);
  store.upsertAll([sampleJob("1")], DAY_TWO);
  expect(store.unscoredSince("Stripe", DAY_TWO)).toMatchObject([{ job_id: "1", first_seen: DAY_ONE, last_seen: DAY_TWO }]);
});

test("unscoredSince ignores jobs missing from that fetch", () => {
  const store = new JobStore(openDatabase(":memory:"));
  store.upsertAll([sampleJob("1"), sampleJob("2")], DAY_ONE);
  store.upsertAll([sampleJob("2")], DAY_TWO);
  expect(store.unscoredSince("Stripe", DAY_TWO).map((row) => row.job_id)).toEqual(["2"]);
});
```

Run: `npm test -- jobStore`
Expected: FAIL. `src/db/jobStore.js` cannot be resolved.

- [ ] **Step 7: Implement the database**

`src/db/open.ts`:

```ts
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  ats TEXT NOT NULL,
  job_id TEXT NOT NULL,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  location TEXT,
  department TEXT,
  team TEXT,
  workplace_type TEXT,
  is_remote INTEGER,
  compensation TEXT,
  url TEXT NOT NULL,
  posted_at TEXT,
  description TEXT,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  scored_at TEXT,
  score INTEGER,
  reasons TEXT,
  gaps TEXT,
  emailed_at TEXT,
  PRIMARY KEY (ats, job_id)
);
CREATE INDEX IF NOT EXISTS jobs_by_company_title ON jobs (company, normalized_title);
`;

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}
```

`src/db/jobStore.ts`:

```ts
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { Job } from "../jobs/job.js";
import { normalizeTitle } from "../jobs/normalize.js";

const nullableText = z.string().nullable();
const jobRow = z.object({
  ats: z.string(),
  job_id: z.string(),
  company: z.string(),
  title: z.string(),
  normalized_title: z.string(),
  location: nullableText,
  department: nullableText,
  team: nullableText,
  workplace_type: nullableText,
  is_remote: z.number().nullable(),
  compensation: nullableText,
  url: z.string(),
  posted_at: nullableText,
  first_seen: z.string(),
  last_seen: z.string(),
  scored_at: nullableText,
  score: z.number().nullable(),
});
export type JobRow = z.infer<typeof jobRow>;

const UPSERT = `
INSERT INTO jobs (ats, job_id, company, title, normalized_title, location, department, team,
  workplace_type, is_remote, compensation, url, posted_at, description, first_seen, last_seen)
VALUES (:ats, :job_id, :company, :title, :normalized_title, :location, :department, :team,
  :workplace_type, :is_remote, :compensation, :url, :posted_at, :description, :seen, :seen)
ON CONFLICT (ats, job_id) DO UPDATE SET
  company = excluded.company, title = excluded.title, normalized_title = excluded.normalized_title,
  location = excluded.location, department = excluded.department, team = excluded.team,
  workplace_type = excluded.workplace_type, is_remote = excluded.is_remote,
  compensation = excluded.compensation, url = excluded.url, posted_at = excluded.posted_at,
  description = excluded.description, last_seen = excluded.last_seen`;
const UNSCORED = "SELECT * FROM jobs WHERE company = ? AND last_seen = ? AND scored_at IS NULL ORDER BY job_id";

export class JobStore {
  constructor(private readonly db: DatabaseSync) {}

  upsertAll(jobs: Job[], seen: string): void {
    const statement = this.db.prepare(UPSERT);
    this.transaction(() => {
      for (const job of jobs) statement.run(toParams(job, seen));
    });
  }

  unscoredSince(company: string, seen: string): JobRow[] {
    return z.array(jobRow).parse(this.db.prepare(UNSCORED).all(company, seen));
  }

  private transaction(work: () => void): void {
    this.db.exec("BEGIN");
    try {
      work();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

function toParams(job: Job, seen: string): Record<string, string | number | null> {
  return {
    ats: job.ats, job_id: job.jobId, company: job.company, title: job.title,
    normalized_title: normalizeTitle(job.title), location: job.location, department: job.department,
    team: job.team, workplace_type: job.workplaceType, is_remote: toFlag(job.isRemote),
    compensation: job.compensation, url: job.url, posted_at: job.postedAt, description: job.description, seen,
  };
}

function toFlag(value: boolean | null): number | null {
  return value === null ? null : Number(value);
}
```

Run: `npm test -- jobStore`
Expected: PASS (2 tests).

- [ ] **Step 8: Write the failing `fetch_jobs` tests**

`tests/helpers/boards.ts`:

```ts
export function greenhouseBoard(titles: string[], firstPublished = "2026-09-01T00:00:00Z"): unknown {
  return {
    jobs: titles.map((title, index) => ({
      id: 1000 + index,
      title,
      absolute_url: `https://example.com/jobs/${1000 + index}`,
      location: { name: "Remote" },
      first_published: firstPublished,
    })),
  };
}
```

`tests/helpers/context.ts` (full file):

```ts
import { JobStore } from "../../src/db/jobStore.js";
import { openDatabase } from "../../src/db/open.js";
import { newRunState, type ToolContext } from "../../src/tools/context.js";
import { testFileConfig } from "./config.js";

export const TEST_NOW = new Date("2026-10-03T12:00:00.000Z");

export function testContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    config: testFileConfig(),
    run: newRunState(),
    store: new JobStore(openDatabase(":memory:")),
    http: { getJson: () => Promise.reject(new Error("unexpected HTTP request in test")) },
    now: () => TEST_NOW,
    ...overrides,
  };
}
```

Append to `tests/helpers/tools.ts` (merge the imports at the top):

```ts
import { z } from "zod";

const pageSchema = z.object({
  company: z.string(),
  total_unscored: z.number(),
  jobs: z.array(z.looseObject({ job_id: z.string() })),
});

export async function fetchPage(context: ToolContext, company: string) {
  return pageSchema.parse(await invokeTool(context, "fetch_jobs", { company }));
}
```

`tests/fetchJobs.test.ts`:

```ts
import { expect, test } from "vitest";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { fetchPage } from "./helpers/tools.js";

test("fetch_jobs returns title-filtered unscored jobs without null fields", async () => {
  const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Account Executive"])) });
  expect(await fetchPage(context, "stripe")).toEqual({
    company: "Stripe",
    total_unscored: 1,
    jobs: [{ job_id: "1000", title: "Backend Engineer", location: "Remote", posted_at: "2026-09-01T00:00:00.000Z" }],
  });
});

test("fetch_jobs pages 25 jobs at a time", async () => {
  const titles = Array.from({ length: 30 }, (_, index) => `Software Engineer ${index}`);
  const page = await fetchPage(testContext({ http: fakeBoard(greenhouseBoard(titles)) }), "Stripe");
  expect(page.total_unscored).toBe(30);
  expect(page.jobs).toHaveLength(25);
});

test("fetch_jobs hits the board only once per run", async () => {
  const http = fakeBoard(greenhouseBoard(["Backend Engineer"]));
  const context = testContext({ http });
  await fetchPage(context, "Stripe");
  await fetchPage(context, "Stripe");
  expect(http.urls).toHaveLength(1);
});

test("fetch_jobs rejects an unknown company", async () => {
  await expect(fetchPage(testContext(), "Initech")).rejects.toThrow('unknown company "Initech"');
});
```

Run: `npm test -- fetchJobs`
Expected: FAIL. `ToolContext` has no `store`/`http`/`now` yet (type errors surface at typecheck), and at runtime there is `no tool named fetch_jobs`.

- [ ] **Step 9: Extend the tool context**

`src/tools/context.ts` (full file):

```ts
import type { FileConfig } from "../config/schema.js";
import type { JobStore } from "../db/jobStore.js";
import type { JsonGetter } from "../http/client.js";

interface RunState {
  finished: boolean;
  summary: string | null;
  fetches: Map<string, Promise<string>>;
}

export interface ToolContext {
  config: FileConfig;
  run: RunState;
  store: JobStore;
  http: JsonGetter;
  now: () => Date;
}

export function newRunState(): RunState {
  return { finished: false, summary: null, fetches: new Map() };
}
```

- [ ] **Step 10: Implement the job summary and `fetch_jobs`**

`src/tools/jobSummary.ts`:

```ts
import type { JobRow } from "../db/jobStore.js";

export function summarizeJob(row: JobRow): Record<string, unknown> {
  return withoutNulls({
    job_id: row.job_id, title: row.title, location: row.location, department: row.department,
    team: row.team, workplace_type: row.workplace_type, is_remote: toBoolean(row.is_remote),
    compensation: row.compensation, posted_at: row.posted_at,
  });
}

function toBoolean(flag: number | null): boolean | null {
  return flag === null ? null : flag === 1;
}

function withoutNulls(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null));
}
```

`src/tools/fetchJobs.ts`:

```ts
import { z } from "zod";
import type { FileConfig } from "../config/schema.js";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import { fetcherFor } from "../sources/index.js";
import type { ToolContext } from "./context.js";
import { summarizeJob } from "./jobSummary.js";
import { defineTool, type Tool } from "./tool.js";

type Company = FileConfig["companies"][number];

const PAGE_SIZE = 25;
const schema = z.object({ company: z.string().describe("Company name exactly as returned by list_companies") });

export function fetchJobsTool(context: ToolContext): Tool {
  return defineTool({
    name: "fetch_jobs",
    description: `Return up to ${PAGE_SIZE} unscored jobs for a company plus total_unscored. Score them with record_matches, then call again until total_unscored is 0.`,
    schema,
    run: ({ company }) => jobPage(context, findCompany(context, company)),
  });
}

async function jobPage(context: ToolContext, company: Company) {
  const seen = await fetchOnce(context, company);
  const filter = context.config.title_filter;
  const unscored = context.store.unscoredSince(company.name, seen).filter((row) => passesTitleFilter(row.title, filter));
  const jobs = unscored.slice(0, PAGE_SIZE).map((row) => summarizeJob(row));
  return { company: company.name, total_unscored: unscored.length, jobs };
}

function fetchOnce(context: ToolContext, company: Company): Promise<string> {
  const cached = context.run.fetches.get(company.name);
  if (cached) return cached;
  const pending = fetchAndStore(context, company);
  context.run.fetches.set(company.name, pending);
  return pending;
}

async function fetchAndStore(context: ToolContext, company: Company): Promise<string> {
  const jobs = await fetcherFor(company.ats)(company, context.http);
  const seen = context.now().toISOString();
  context.store.upsertAll(jobs, seen);
  return seen;
}

function findCompany(context: ToolContext, name: string): Company {
  const wanted = name.trim().toLowerCase();
  const company = context.config.companies.find((candidate) => candidate.name.toLowerCase() === wanted);
  if (!company) throw new Error(`unknown company "${name}"; call list_companies for valid names`);
  return company;
}
```

Register it. `src/tools/registry.ts`:

```ts
import type { ToolContext } from "./context.js";
import { fetchJobsTool } from "./fetchJobs.js";
import { finishTool } from "./finish.js";
import { listCompaniesTool } from "./listCompanies.js";
import type { Tool } from "./tool.js";

export function buildTools(context: ToolContext): Tool[] {
  return [listCompaniesTool(context), fetchJobsTool(context), finishTool(context)];
}
```

Run: `npm test -- fetchJobs`
Expected: PASS (4 tests).

- [ ] **Step 11: Write the failing `run` test for the new seam**

Append to `tests/run.test.ts` (merge imports):

```ts
import { greenhouseBoard } from "./helpers/boards.js";
import { fakeBoard } from "./helpers/http.js";
import { toolCallsReply } from "./helpers/chat.js";

test("runOnce stores fetched jobs in the data directory database", async () => {
  const dataDir = makeDataDir();
  const http = fakeBoard(greenhouseBoard(["Backend Engineer"]));
  const replies = [toolCallsReply(["fetch_jobs", { company: "Stripe" }], ["finish", { summary: "done" }])];
  const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat: scriptedChat(replies).chat, http });
  expect(report.status).toBe("finished");
  expect(http.urls).toEqual(["https://boards-api.greenhouse.io/v1/boards/stripe/jobs"]);
});
```

Run: `npm test -- run.test`
Expected: FAIL. `fetch_jobs` throws because the context has no `store`/`http`, and `http` is not an accepted seam.

- [ ] **Step 12: Wire the store and HTTP client into `run`**

In `src/app/run.ts`:

- Add imports:

```ts
import { JobStore } from "../db/jobStore.js";
import { openDatabase } from "../db/open.js";
import { HttpClient, type JsonGetter } from "../http/client.js";
```

- Extend the seams:

```ts
interface RunSeams {
  chat?: ChatFn;
  http?: JsonGetter;
}
```

- Replace `buildContext`, and change the call in `runOnce` to `buildContext(config, seams)`:

```ts
function buildContext(config: AppConfig, seams: RunSeams): ToolContext {
  return {
    config: config.file,
    run: newRunState(),
    store: new JobStore(openDatabase(join(config.dataDir, "myjobbot.db"))),
    http: seams.http ?? new HttpClient(config.file.http, globalThis.fetch),
    now: () => new Date(),
  };
}
```

- [ ] **Step 13: Verify**

Run: `npm run check`
Expected: all tests pass, typecheck clean, habit-hooks clean.

- [ ] **Step 14: Commit**

```bash
git add src/ tests/
git commit -m "Add fetch_jobs with Greenhouse adapter, title filter and SQLite store"
```

---

### Task 6: `record_matches` tool

**Files:**
- Create: `src/tools/recordMatches.ts`, `tests/recordMatches.test.ts`
- Modify: `src/db/jobStore.ts`, `src/tools/registry.ts`

- [ ] **Step 1: Write the failing tests**

`tests/recordMatches.test.ts`:

```ts
import { expect, test } from "vitest";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { fetchPage, invokeTool } from "./helpers/tools.js";

function boardContext() {
  return testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Platform Engineer"])) });
}

test("record_matches scores jobs so fetch_jobs stops offering them", async () => {
  const context = boardContext();
  await fetchPage(context, "Stripe");
  const verdicts = [{ job_id: "1000", score: 85, reasons: ["Go backend"], gaps: [] }];
  expect(await invokeTool(context, "record_matches", { verdicts })).toEqual({ recorded: 1, unknown_job_ids: [] });
  expect((await fetchPage(context, "Stripe")).jobs.map((job) => job.job_id)).toEqual(["1001"]);
});

test("record_matches reports unknown job ids", async () => {
  const result = await invokeTool(boardContext(), "record_matches", { verdicts: [{ job_id: "nope", score: 10 }] });
  expect(result).toEqual({ recorded: 0, unknown_job_ids: ["nope"] });
});

test("record_matches accepts numeric job ids", async () => {
  const context = boardContext();
  await fetchPage(context, "Stripe");
  expect(await invokeTool(context, "record_matches", { verdicts: [{ job_id: 1000, score: 5 }] })).toMatchObject({ recorded: 1 });
});

test("record_matches rejects out-of-range scores", async () => {
  const verdicts = [{ job_id: "1000", score: 140 }];
  await expect(invokeTool(boardContext(), "record_matches", { verdicts })).rejects.toThrow();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- recordMatches`
Expected: FAIL with `no tool named record_matches`.

- [ ] **Step 3: Implement**

Add to `src/db/jobStore.ts` (constant near the other SQL, interface above the class, method inside the class):

```ts
const RECORD_VERDICT = "UPDATE jobs SET score = ?, reasons = ?, gaps = ?, scored_at = ? WHERE job_id = ?";

interface Verdict {
  job_id: string;
  score: number;
  reasons: string[];
  gaps: string[];
}
```

```ts
  recordVerdict(verdict: Verdict, scoredAt: string): boolean {
    const { job_id, score, reasons, gaps } = verdict;
    const result = this.db.prepare(RECORD_VERDICT).run(score, JSON.stringify(reasons), JSON.stringify(gaps), scoredAt, job_id);
    return Number(result.changes) > 0;
  }
```

`src/tools/recordMatches.ts`:

```ts
import { z } from "zod";
import type { ToolContext } from "./context.js";
import { defineTool, type Tool } from "./tool.js";

const MAX_VERDICTS = 25;
const verdict = z.object({
  job_id: z.union([z.string(), z.number()]).transform(String),
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
});
const schema = z.object({ verdicts: z.array(verdict).min(1).max(MAX_VERDICTS) });

export function recordMatchesTool(context: ToolContext): Tool {
  return defineTool({
    name: "record_matches",
    description: `Save fit scores (0-100) for up to ${MAX_VERDICTS} jobs returned by fetch_jobs. Give reasons and gaps for scores of 40 or more.`,
    schema,
    run: ({ verdicts }) => record(context, verdicts),
  });
}

function record(context: ToolContext, verdicts: Array<z.infer<typeof verdict>>) {
  const scoredAt = context.now().toISOString();
  const unknown = verdicts.filter((entry) => !context.store.recordVerdict(entry, scoredAt)).map((entry) => entry.job_id);
  return { recorded: verdicts.length - unknown.length, unknown_job_ids: unknown };
}
```

Register it in `src/tools/registry.ts`: import `recordMatchesTool` and change the list to:

```ts
  return [listCompaniesTool(context), fetchJobsTool(context), recordMatchesTool(context), finishTool(context)];
```

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: all pass, habit-hooks clean.

- [ ] **Step 5: Commit**

```bash
git add src/ tests/
git commit -m "Add record_matches tool for batched verdicts"
```

---

### Task 7: Per-host rate limiter and retries

**Files:**
- Create: `src/http/clock.ts`, `src/http/limiter.ts`, `tests/helpers/clock.ts`, `tests/limiter.test.ts`
- Modify: `src/http/client.ts`, `src/app/run.ts`, `tests/httpClient.test.ts`

- [ ] **Step 1: Write the failing limiter tests**

`tests/helpers/clock.ts`:

```ts
import type { Clock } from "../../src/http/clock.js";

export function fakeClock(): Clock & { sleeps: number[] } {
  let now = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
  };
}
```

`tests/limiter.test.ts`:

```ts
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
```

- [ ] **Step 2: Rewrite the HTTP client tests for the new behavior**

`tests/httpClient.test.ts` (full file):

```ts
import { expect, test } from "vitest";
import { HttpClient } from "../src/http/client.js";
import { fakeClock } from "./helpers/clock.js";
import { testFileConfig } from "./helpers/config.js";
import { jsonResponse, scriptedFetch } from "./helpers/http.js";

const URL_A = "https://a.example/board";

function client(responses: Response[]) {
  const clock = fakeClock();
  const { fetchFn, urls } = scriptedFetch(responses);
  const http = new HttpClient({ config: testFileConfig().http, clock, fetchFn, random: () => 0 });
  return { http, clock, urls };
}

test("HttpClient returns parsed JSON", async () => {
  const { http } = client([jsonResponse({ jobs: [] })]);
  expect(await http.getJson(URL_A)).toEqual({ jobs: [] });
});

test("HttpClient retries a 503 with exponential backoff", async () => {
  const { http, clock, urls } = client([jsonResponse({}, 503), jsonResponse({ ok: true })]);
  expect(await http.getJson(URL_A)).toEqual({ ok: true });
  expect(urls).toHaveLength(2);
  expect(clock.sleeps).toEqual([1000]);
});

test("HttpClient honors Retry-After, capped at max_retry_after_s", async () => {
  const { http, clock } = client([
    jsonResponse({}, 429, { "retry-after": "7" }),
    jsonResponse({}, 429, { "retry-after": "999" }),
    jsonResponse({ ok: true }),
  ]);
  await http.getJson(URL_A);
  expect(clock.sleeps).toEqual([7000, 60_000]);
});

test("HttpClient gives up after max_retries", async () => {
  const { http, urls } = client([jsonResponse({}, 503), jsonResponse({}, 503), jsonResponse({}, 503)]);
  await expect(http.getJson(URL_A)).rejects.toThrow("HTTP 503");
  expect(urls).toHaveLength(3);
});

test("HttpClient does not retry a 404", async () => {
  const { http, urls } = client([jsonResponse({}, 404)]);
  await expect(http.getJson(URL_A)).rejects.toThrow("HTTP 404");
  expect(urls).toHaveLength(1);
});
```

The backoff sleeps also satisfy the limiter's 1000 ms interval, so the limiter adds no extra sleeps in these tests.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- limiter httpClient`
Expected: FAIL. `src/http/limiter.js` and `src/http/clock.js` cannot be resolved, and the `HttpClient` constructor signature differs.

- [ ] **Step 4: Implement clock, limiter and the retrying client**

`src/http/clock.ts`:

```ts
export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
```

`src/http/limiter.ts`:

```ts
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
```

`src/http/client.ts` (full file):

```ts
import type { FileConfig } from "../config/schema.js";
import type { Clock } from "./clock.js";
import { HostLimiter } from "./limiter.js";

const MS_PER_SECOND = 1000;
const BASE_BACKOFF_MS = 1000;
const JITTER_MS = 500;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export interface JsonGetter {
  getJson(url: string): Promise<unknown>;
}

interface HttpDeps {
  config: FileConfig["http"];
  clock: Clock;
  fetchFn: (url: string, init: RequestInit) => Promise<Response>;
  random: () => number;
}

export class HttpClient implements JsonGetter {
  private readonly limiter: HostLimiter;

  constructor(private readonly deps: HttpDeps) {
    this.limiter = new HostLimiter(deps.config, deps.clock);
  }

  async getJson(url: string): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await this.send(url);
      if (response.ok) return response.json();
      await response.body?.cancel();
      if (!this.shouldRetry(response.status, attempt)) throw new Error(`GET ${url} failed with HTTP ${response.status}`);
      await this.deps.clock.sleep(this.backoffMs(response, attempt));
    }
  }

  private send(url: string): Promise<Response> {
    const signal = AbortSignal.timeout(this.deps.config.timeout_s * MS_PER_SECOND);
    return this.limiter.schedule(new URL(url).host, () => this.deps.fetchFn(url, { signal }));
  }

  private shouldRetry(status: number, attempt: number): boolean {
    return RETRYABLE_STATUSES.has(status) && attempt < this.deps.config.max_retries;
  }

  private backoffMs(response: Response, attempt: number): number {
    const capMs = this.deps.config.max_retry_after_s * MS_PER_SECOND;
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    if (retryAfterSeconds > 0) return Math.min(retryAfterSeconds * MS_PER_SECOND, capMs);
    return Math.min(BASE_BACKOFF_MS * 2 ** attempt + this.deps.random() * JITTER_MS, capMs);
  }
}
```

In `src/app/run.ts`, import `systemClock` from `../http/clock.js` and change the `http:` line in `buildContext` to:

```ts
    http: seams.http ?? new HttpClient({ config: config.file.http, clock: systemClock, fetchFn: globalThis.fetch, random: Math.random }),
```

- [ ] **Step 5: Verify**

Run: `npm run check`
Expected: all pass, habit-hooks clean.

- [ ] **Step 6: Commit**

```bash
git add src/ tests/
git commit -m "Rate-limit board requests per host and retry 429/5xx with backoff"
```

---

### Task 8: Lever and Ashby adapters

**Files:**
- Create: `src/sources/lever.ts`, `src/sources/ashby.ts`, `tests/fixtures/lever.json`, `tests/fixtures/ashby.json`
- Modify: `src/sources/index.ts`, `src/sources/fields.ts`, `tests/sources.test.ts`

- [ ] **Step 1: Add fixtures**

`tests/fixtures/lever.json`:

```json
[
  {
    "id": "10dfc8bc-99ad-4ca2-ab76-853cb90a92c2",
    "text": "Backend Software Engineer - Application Development",
    "hostedUrl": "https://jobs.lever.co/palantir/10dfc8bc-99ad-4ca2-ab76-853cb90a92c2",
    "applyUrl": "https://jobs.lever.co/palantir/10dfc8bc-99ad-4ca2-ab76-853cb90a92c2/apply",
    "createdAt": 1710188707256,
    "workplaceType": "hybrid",
    "country": "GB",
    "descriptionPlain": "Backend Software Engineers at Palantir build software at scale.",
    "categories": {
      "commitment": "Full-time",
      "location": "London, United Kingdom",
      "team": "Dev",
      "allLocations": ["London, United Kingdom"]
    }
  },
  {
    "id": "5b1e0a52-0000-4000-8000-000000000002",
    "text": "Forward Deployed Engineer",
    "hostedUrl": "https://jobs.lever.co/palantir/5b1e0a52-0000-4000-8000-000000000002"
  }
]
```

`tests/fixtures/ashby.json`:

```json
{
  "apiVersion": "1",
  "jobs": [
    {
      "id": "240d459b-696d-43eb-8497-fab3e56ecd9b",
      "title": "Software Engineer, Infrastructure",
      "department": "Engineering",
      "team": "Infrastructure",
      "employmentType": "FullTime",
      "location": "San Francisco",
      "secondaryLocations": [],
      "publishedAt": "2025-04-05T00:03:20.653+00:00",
      "isListed": true,
      "isRemote": false,
      "workplaceType": "Hybrid",
      "jobUrl": "https://jobs.ashbyhq.com/openai/240d459b-696d-43eb-8497-fab3e56ecd9b",
      "descriptionPlain": "Build the infrastructure that trains frontier models.",
      "compensation": {
        "compensationTierSummary": "$250K - $445K, Offers Equity",
        "scrapeableCompensationSalarySummary": "$250K - $445K"
      }
    },
    {
      "id": "9c0f3a10-0000-4000-8000-000000000003",
      "title": "Unlisted Engineer",
      "jobUrl": "https://jobs.ashbyhq.com/openai/9c0f3a10-0000-4000-8000-000000000003",
      "isListed": false
    }
  ]
}
```

- [ ] **Step 2: Add the failing cases**

In `tests/sources.test.ts`, append these two entries to `CASES`:

```ts
  {
    ats: "lever" as const,
    slug: "palantir",
    url: "https://api.lever.co/v0/postings/palantir?mode=json",
    count: 2,
    first: {
      jobId: "10dfc8bc-99ad-4ca2-ab76-853cb90a92c2",
      title: "Backend Software Engineer - Application Development",
      location: "London, United Kingdom",
      team: "Dev",
      workplaceType: "hybrid",
      postedAt: "2024-03-11T20:25:07.256Z",
      description: "Backend Software Engineers at Palantir build software at scale.",
    },
  },
  {
    ats: "ashby" as const,
    slug: "openai",
    url: "https://api.ashbyhq.com/posting-api/job-board/openai?includeCompensation=true",
    count: 1,
    first: {
      jobId: "240d459b-696d-43eb-8497-fab3e56ecd9b",
      title: "Software Engineer, Infrastructure",
      department: "Engineering",
      team: "Infrastructure",
      location: "San Francisco",
      isRemote: false,
      workplaceType: "Hybrid",
      compensation: "$250K - $445K, Offers Equity",
      postedAt: "2025-04-05T00:03:20.653Z",
    },
  },
```

Run: `npm test -- sources`
Expected: FAIL. The lever and ashby cases throw `this board type is not supported yet`.

- [ ] **Step 3: Implement the adapters**

`src/sources/lever.ts`:

```ts
import { z } from "zod";
import type { JsonGetter } from "../http/client.js";
import { makeJob, type Job } from "../jobs/job.js";
import { optionalDate, optionalText } from "./fields.js";
import type { BoardRef } from "./types.js";

const posting = z.object({
  id: z.string(),
  text: z.string(),
  hostedUrl: z.string(),
  createdAt: optionalDate,
  workplaceType: optionalText,
  descriptionPlain: optionalText,
  categories: z.object({ location: optionalText, team: optionalText, department: optionalText }).nullish(),
});

export async function fetchLever(ref: BoardRef, http: JsonGetter): Promise<Job[]> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(ref.slug)}?mode=json`;
  const postings = z.array(posting).parse(await http.getJson(url));
  return postings.map((post) => toJob(ref.name, post));
}

function toJob(company: string, post: z.infer<typeof posting>): Job {
  return makeJob(
    { ats: "lever", jobId: post.id, company, title: post.text, url: post.hostedUrl },
    { ...post.categories, workplaceType: post.workplaceType, postedAt: post.createdAt, description: post.descriptionPlain },
  );
}
```

`src/sources/ashby.ts`:

```ts
import { z } from "zod";
import type { JsonGetter } from "../http/client.js";
import { makeJob, type Job } from "../jobs/job.js";
import { optionalDate, optionalFlag, optionalText } from "./fields.js";
import type { BoardRef } from "./types.js";

const posting = z.object({
  id: z.string(),
  title: z.string(),
  jobUrl: z.string(),
  department: optionalText,
  team: optionalText,
  location: optionalText,
  isRemote: optionalFlag,
  workplaceType: optionalText,
  publishedAt: optionalDate,
  descriptionPlain: optionalText,
  isListed: optionalFlag,
  compensation: z.object({ compensationTierSummary: optionalText }).nullish(),
});
const board = z.object({ jobs: z.array(posting) });

export async function fetchAshby(ref: BoardRef, http: JsonGetter): Promise<Job[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(ref.slug)}?includeCompensation=true`;
  const { jobs } = board.parse(await http.getJson(url));
  return jobs.filter((post) => post.isListed !== false).map((post) => toJob(ref.name, post));
}

function toJob(company: string, post: z.infer<typeof posting>): Job {
  const { department, team, location, isRemote, workplaceType } = post;
  const compensation = post.compensation?.compensationTierSummary ?? null;
  return makeJob(
    { ats: "ashby", jobId: post.id, company, title: post.title, url: post.jobUrl },
    { department, team, location, isRemote, workplaceType, compensation, postedAt: post.publishedAt, description: post.descriptionPlain },
  );
}
```

`src/sources/index.ts` (full file):

```ts
import type { Ats } from "../jobs/job.js";
import { fetchAshby } from "./ashby.js";
import { fetchGreenhouse } from "./greenhouse.js";
import { fetchLever } from "./lever.js";
import type { BoardFetcher } from "./types.js";

const FETCHERS: Record<Ats, BoardFetcher> = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
};

export function fetcherFor(ats: Ats): BoardFetcher {
  return FETCHERS[ats];
}
```

Add the boolean helper Ashby needs to `src/sources/fields.ts`, below `optionalText`:

```ts
export const optionalFlag = z.boolean().nullish().transform((value) => value ?? null);
```

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: all pass (4 source tests), habit-hooks clean.

- [ ] **Step 5: Commit**

```bash
git add src/sources/ tests/
git commit -m "Add Lever and Ashby board adapters"
```

---

### Task 9: Ghost-post detection and retention pruning

**Files:**
- Create: `src/jobs/age.ts`
- Modify: `src/db/jobStore.ts`, `src/tools/jobSummary.ts`, `src/tools/fetchJobs.ts`, `src/app/run.ts`, `tests/jobStore.test.ts`, `tests/fetchJobs.test.ts`, `tests/run.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/jobStore.test.ts`:

```ts
test("earliestSeen uses the older of posted_at and first_seen across reposts", () => {
  const store = new JobStore(openDatabase(":memory:"));
  store.upsertAll([sampleJob("old")], "2026-06-01T00:00:00.000Z");
  const repost = makeJob({ ats: "greenhouse", jobId: "new", company: "Stripe", title: "Backend Engineer!", url: "u" }, { postedAt: "2026-09-01T00:00:00.000Z" });
  store.upsertAll([repost], DAY_TWO);
  expect(store.earliestSeen("Stripe", "backend engineer")).toBe("2026-06-01T00:00:00.000Z");
});

test("pruneLastSeenBefore deletes stale jobs only", () => {
  const store = new JobStore(openDatabase(":memory:"));
  store.upsertAll([sampleJob("1")], DAY_ONE);
  store.upsertAll([sampleJob("2")], DAY_TWO);
  expect(store.pruneLastSeenBefore(DAY_TWO)).toBe(1);
  expect(store.unscoredSince("Stripe", DAY_TWO).map((row) => row.job_id)).toEqual(["2"]);
});
```

In `tests/fetchJobs.test.ts`, change the expected job in the first test to:

```ts
    jobs: [{ job_id: "1000", title: "Backend Engineer", location: "Remote", posted_at: "2026-09-01T00:00:00.000Z", days_open: 32, possible_ghost: false }],
```

and append:

```ts
test("fetch_jobs flags postings open longer than the ghost threshold", async () => {
  const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer"], "2026-07-01T00:00:00Z")) });
  expect((await fetchPage(context, "Stripe")).jobs[0]).toMatchObject({ days_open: 94, possible_ghost: true });
});
```

Append to `tests/run.test.ts` (merge imports):

```ts
import { JobStore } from "../src/db/jobStore.js";
import { openDatabase } from "../src/db/open.js";
import { makeJob } from "../src/jobs/job.js";

test("runOnce prunes jobs not seen within job_retention_days", async () => {
  const dataDir = makeDataDir();
  const db = openDatabase(join(dataDir, "myjobbot.db"));
  const stale = makeJob({ ats: "greenhouse", jobId: "stale", company: "Stripe", title: "Old Engineer", url: "u" }, {});
  new JobStore(db).upsertAll([stale], "2020-01-01T00:00:00.000Z");
  const { chat } = scriptedChat([toolCallReply("finish", { summary: "done" })]);
  await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat });
  expect({ ...db.prepare("SELECT COUNT(*) AS count FROM jobs").get() }).toEqual({ count: 0 });
});
```

node:sqlite rows have a null prototype; spreading them into plain objects keeps `toEqual` comparisons straightforward.

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- jobStore fetchJobs run.test`
Expected: FAIL. `earliestSeen`/`pruneLastSeenBefore` don't exist, summaries lack `days_open`, and the stale job survives.

- [ ] **Step 3: Implement**

`src/jobs/age.ts`:

```ts
export const MS_PER_DAY = 86_400_000;

export function daysBetween(earlierIso: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(earlierIso)) / MS_PER_DAY);
}
```

Add to `src/db/jobStore.ts` (constants with the other SQL, methods inside the class):

```ts
const EARLIEST_SEEN = `
SELECT MIN(MIN(first_seen), COALESCE(MIN(posted_at), MIN(first_seen))) AS earliest
FROM jobs WHERE company = ? AND normalized_title = ?`;
const PRUNE = "DELETE FROM jobs WHERE last_seen < ?";
```

```ts
  earliestSeen(company: string, normalizedTitle: string): string {
    const row = this.db.prepare(EARLIEST_SEEN).get(company, normalizedTitle);
    return z.object({ earliest: z.string() }).parse(row).earliest;
  }

  pruneLastSeenBefore(cutoff: string): number {
    return Number(this.db.prepare(PRUNE).run(cutoff).changes);
  }
```

`src/tools/jobSummary.ts` (full file):

```ts
import type { JobRow } from "../db/jobStore.js";
import { daysBetween } from "../jobs/age.js";
import type { ToolContext } from "./context.js";

export function summarizeJob(context: ToolContext, row: JobRow): Record<string, unknown> {
  const daysOpen = daysBetween(context.store.earliestSeen(row.company, row.normalized_title), context.now());
  return withoutNulls({
    job_id: row.job_id, title: row.title, location: row.location, department: row.department,
    team: row.team, workplace_type: row.workplace_type, is_remote: toBoolean(row.is_remote),
    compensation: row.compensation, posted_at: row.posted_at,
    days_open: daysOpen, possible_ghost: daysOpen > context.config.ghost_threshold_days,
  });
}

function toBoolean(flag: number | null): boolean | null {
  return flag === null ? null : flag === 1;
}

function withoutNulls(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null));
}
```

In `src/tools/fetchJobs.ts`, change the `jobs` line in `jobPage` to:

```ts
  const jobs = unscored.slice(0, PAGE_SIZE).map((row) => summarizeJob(context, row));
```

In `src/app/run.ts`, import `MS_PER_DAY` from `../jobs/age.js`, add:

```ts
function pruneOldJobs(context: ToolContext): void {
  const cutoff = new Date(context.now().getTime() - context.config.job_retention_days * MS_PER_DAY);
  context.store.pruneLastSeenBefore(cutoff.toISOString());
}
```

and call it in `runOnce` right after `runAgent` resolves:

```ts
  const result = await runAgent(agentDeps(config, context, seams), initialMessages(config));
  pruneOldJobs(context);
  return { ...result, summary: context.run.summary };
```

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: all pass, habit-hooks clean.

- [ ] **Step 5: Commit**

```bash
git add src/ tests/
git commit -m "Flag long-open postings and prune jobs past retention"
```

---

### Task 10: `get_job_details` stub

**Files:**
- Create: `src/tools/getJobDetails.ts`, `tests/getJobDetails.test.ts`
- Modify: `src/db/jobStore.ts`, `src/tools/registry.ts`

- [ ] **Step 1: Write the failing tests**

`tests/getJobDetails.test.ts`:

```ts
import { expect, test } from "vitest";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard } from "./helpers/http.js";
import { fetchPage, invokeTool } from "./helpers/tools.js";

test("get_job_details returns stored metadata and marks descriptions unavailable", async () => {
  const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer"])) });
  await fetchPage(context, "Stripe");
  expect(await invokeTool(context, "get_job_details", { job_id: "1000" })).toMatchObject({
    job_id: "1000",
    title: "Backend Engineer",
    full_description: "not_available_in_v1",
  });
});

test("get_job_details rejects an unknown job id", async () => {
  await expect(invokeTool(testContext(), "get_job_details", { job_id: "nope" })).rejects.toThrow('unknown job_id "nope"');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- getJobDetails`
Expected: FAIL with `no tool named get_job_details`.

- [ ] **Step 3: Implement**

Add to `src/db/jobStore.ts`:

```ts
const FIND_JOB = "SELECT * FROM jobs WHERE job_id = ? LIMIT 1";
```

```ts
  findJob(jobId: string): JobRow | null {
    const row = this.db.prepare(FIND_JOB).get(jobId);
    return row === undefined ? null : jobRow.parse(row);
  }
```

`src/tools/getJobDetails.ts`:

```ts
import { z } from "zod";
import type { ToolContext } from "./context.js";
import { summarizeJob } from "./jobSummary.js";
import { defineTool, type Tool } from "./tool.js";

const schema = z.object({ job_id: z.union([z.string(), z.number()]).transform(String) });

export function getJobDetailsTool(context: ToolContext): Tool {
  return defineTool({
    name: "get_job_details",
    description: "Return stored details for one job. Full descriptions are not available yet; this returns the same metadata as fetch_jobs.",
    schema,
    run: ({ job_id }) => details(context, job_id),
  });
}

function details(context: ToolContext, jobId: string): Record<string, unknown> {
  const row = context.store.findJob(jobId);
  if (!row) throw new Error(`unknown job_id "${jobId}"`);
  return { ...summarizeJob(context, row), full_description: "not_available_in_v1" };
}
```

`src/tools/registry.ts` (full file):

```ts
import type { ToolContext } from "./context.js";
import { fetchJobsTool } from "./fetchJobs.js";
import { finishTool } from "./finish.js";
import { getJobDetailsTool } from "./getJobDetails.js";
import { listCompaniesTool } from "./listCompanies.js";
import { recordMatchesTool } from "./recordMatches.js";
import type { Tool } from "./tool.js";

export function buildTools(context: ToolContext): Tool[] {
  return [
    listCompaniesTool(context),
    fetchJobsTool(context),
    getJobDetailsTool(context),
    recordMatchesTool(context),
    finishTool(context),
  ];
}
```

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: all pass, habit-hooks clean.

- [ ] **Step 5: Commit**

```bash
git add src/ tests/
git commit -m "Add get_job_details stub tool"
```

---

### Task 11: Context compaction

**Files:**
- Create: `src/agent/compact.ts`, `tests/compact.test.ts`
- Modify: `src/agent/loop.ts`, `tests/agent-loop.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/compact.test.ts`:

```ts
import { expect, test } from "vitest";
import { compactInPlace } from "../src/agent/compact.js";
import { toHistory, type Message } from "../src/agent/llm.js";
import { toolCallReply } from "./helpers/chat.js";

function history(rounds: number): Message[] {
  const messages: Message[] = [{ role: "system", content: "sys" }, { role: "user", content: "resume" }];
  for (let round = 0; round < rounds; round += 1) {
    messages.push(toHistory(toolCallReply("fetch_jobs", { company: "Stripe" })));
    messages.push({ role: "tool", tool_call_id: "call_0", content: "x".repeat(100) });
  }
  return messages;
}

test("compactInPlace leaves history under budget untouched", () => {
  const messages = history(6);
  expect(compactInPlace(messages, 1_000_000)).toBe(0);
  expect(messages).toEqual(history(6));
});

test("compactInPlace elides old tool traffic but keeps the head and recent messages", () => {
  const messages = history(6);
  expect(compactInPlace(messages, 100)).toBe(4);
  expect(messages.slice(0, 2)).toEqual(history(6).slice(0, 2));
  expect(messages[3]).toMatchObject({ role: "tool", content: expect.stringContaining("elided") });
  expect(JSON.stringify(messages[2])).toContain('"arguments":"{}"');
  expect(messages.slice(-8)).toEqual(history(6).slice(-8));
});

test("compactInPlace is stable once elided", () => {
  const messages = history(6);
  compactInPlace(messages, 100);
  expect(compactInPlace(messages, 100)).toBe(0);
});
```

Append to `tests/agent-loop.test.ts`:

```ts
test("agent compacts history when it exceeds the context budget", async () => {
  const list = toolCallReply("list_companies", {});
  const replies = [list, list, list, list, list, list, FINISH];
  const { events, requests } = await runScripted(replies, { limits: { ...TEST_LIMITS, context_chars: 50 } });
  expect(events.some((event) => event.type === "compacted")).toBe(true);
  expect(JSON.stringify(requests[6]?.[3])).toContain("elided");
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- compact agent-loop`
Expected: FAIL. `src/agent/compact.js` cannot be resolved, and no `compacted` event is emitted.

- [ ] **Step 3: Implement compaction**

`src/agent/compact.ts`:

```ts
import type OpenAI from "openai";
import type { Message } from "./llm.js";

type ToolCall = OpenAI.Chat.ChatCompletionMessageToolCall;

const PINNED_HEAD = 2;
const KEEP_RECENT = 8;
const EMPTY_ARGUMENTS = "{}";
const ELIDED = "[elided to save context; tools return current state, so call them again if you need it]";

export function compactInPlace(messages: Message[], budgetChars: number): number {
  if (JSON.stringify(messages).length <= budgetChars) return 0;
  let elided = 0;
  for (let index = PINNED_HEAD; index < messages.length - KEEP_RECENT; index += 1) {
    const before = messages[index];
    const after = before && elide(before);
    if (!after || after === before) continue;
    messages[index] = after;
    elided += 1;
  }
  return elided;
}

function elide(message: Message): Message {
  if (message.role === "tool") return message.content === ELIDED ? message : { ...message, content: ELIDED };
  if (message.role !== "assistant" || !message.tool_calls?.some(hasArguments)) return message;
  return { ...message, tool_calls: message.tool_calls.map(clearArguments) };
}

function hasArguments(call: ToolCall): boolean {
  return call.type === "function" && call.function.arguments !== EMPTY_ARGUMENTS;
}

function clearArguments(call: ToolCall): ToolCall {
  return call.type === "function" ? { ...call, function: { ...call.function, arguments: EMPTY_ARGUMENTS } } : call;
}
```

In `src/agent/loop.ts`, import `compactInPlace` from `./compact.js`, add this method to `AgentSession`:

```ts
  private compact(): void {
    const elided = compactInPlace(this.messages, this.deps.limits.context_chars);
    if (elided > 0) this.deps.trace.write({ type: "compacted", elided });
  }
```

and call it at the top of `step()`, after `countStep()`:

```ts
  private async step(): Promise<void> {
    this.budget.countStep();
    this.compact();
    const reply = await this.deps.chat(this.messages, this.deps.tools);
    this.record({ type: "assistant", content: reply.content, tool_calls: reply.tool_calls }, toHistory(reply));
    const calls = functionCalls(reply);
    if (calls.length === 0) return this.nudge();
    for (const call of calls) await this.execute(call);
  }
```

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: all pass, habit-hooks clean.

- [ ] **Step 5: Commit**

```bash
git add src/agent/ tests/
git commit -m "Elide old agent context in stable chunks when over budget"
```

---

### Task 12: Scripted end-to-end test, docs, and live smoke run

**Files:**
- Create: `tests/e2e.test.ts`, `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write the scripted end-to-end test**

`tests/e2e.test.ts`:

```ts
import { join } from "node:path";
import { expect, test } from "vitest";
import { runOnce } from "../src/app/run.js";
import { openDatabase } from "../src/db/open.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { scriptedChat, toolCallReply } from "./helpers/chat.js";
import { makeDataDir, TEST_ENV } from "./helpers/dataDir.js";
import { fakeBoard } from "./helpers/http.js";

const VERDICTS = [
  { job_id: "1000", score: 90, reasons: ["Backend, Go"], gaps: [] },
  { job_id: "1001", score: 10 },
];

const SCRIPT = [
  toolCallReply("list_companies", {}),
  toolCallReply("fetch_jobs", { company: "Stripe" }),
  toolCallReply("record_matches", { verdicts: VERDICTS }),
  toolCallReply("fetch_jobs", { company: "Stripe" }),
  toolCallReply("finish", { summary: "Scored 2 Stripe jobs." }),
];

test("a scripted model drives a full run and its verdicts land in SQLite", async () => {
  const dataDir = makeDataDir();
  const http = fakeBoard(greenhouseBoard(["Backend Engineer", "Platform Engineer"]));
  const report = await runOnce({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dataDir }, { chat: scriptedChat(SCRIPT).chat, http });
  expect(report).toMatchObject({ status: "finished", steps: 5, summary: "Scored 2 Stripe jobs." });
  const rows = openDatabase(join(dataDir, "myjobbot.db")).prepare("SELECT job_id, score FROM jobs ORDER BY job_id").all();
  expect(rows.map((row) => ({ ...row }))).toEqual([{ job_id: "1000", score: 90 }, { job_id: "1001", score: 10 }]);
});
```

Run: `npm test -- e2e`
Expected: PASS. Every piece already exists; this test pins the whole flow. If it fails, fix the defect it exposes before continuing.

- [ ] **Step 2: Write `README.md`**

````markdown
# myjobbot

An autonomous agent that pulls software-engineering postings from company job boards
(Greenhouse, Lever, Ashby), scores them against your resume with a local LLM, and keeps
history in SQLite to spot long-open "ghost" postings.

Design: `docs/superpowers/specs/2026-10-03-myjobbot-design.md`

## Setup

```bash
npm ci
cp .env.example .env            # set LLM_API_KEY
mkdir -p data
cp examples/config.yaml data/   # list your target companies
cp examples/resume.md data/     # replace with your resume
```

The LLM server must be llama.cpp `llama-server` started with `--jinja` and a
tool-calling model.

## Run

```bash
npm start -- run
```

Each run writes a JSONL trace of every model message and tool call to `data/runs/`.

## Develop

```bash
npm run check   # typecheck + tests + habit-hooks
```
````

- [ ] **Step 3: Add commands to `CLAUDE.md`**

Append:

```markdown
## Commands

- `npm run check`: typecheck, tests, habit-hooks (run before claiming any task done)
- `npm start -- run`: one agent run using `.env` and `data/`
- Traces: `data/runs/*.jsonl`
```

- [ ] **Step 4: Verify and commit**

Run: `npm run check`
Expected: all pass, habit-hooks clean.

```bash
git add tests/e2e.test.ts README.md CLAUDE.md
git commit -m "Add scripted end-to-end test and README"
```

- [ ] **Step 5: Live smoke run against the LLM server (one company)**

```bash
cp .env.example .env    # then set LLM_API_KEY to the real key; .env is gitignored
mkdir -p data && cp examples/resume.md data/resume.md
printf 'companies:\n  - { name: Palantir, ats: lever, slug: palantir }\npreferences: Senior backend, remote US\n' > data/config.yaml
npm start -- run
```

Expected: after a few minutes, `run finished after N steps: finish called` and a summary paragraph.

Inspect the run:

```bash
ls data/runs/
tail -n 2 data/runs/*.jsonl
node --disable-warning=ExperimentalWarning -e 'const {DatabaseSync}=require("node:sqlite");const db=new DatabaseSync("data/myjobbot.db");console.log(db.prepare("SELECT COUNT(*) total, COUNT(scored_at) scored, SUM(score>=70) matches FROM jobs").get());console.log(db.prepare("SELECT title, score, reasons FROM jobs WHERE score>=70 ORDER BY score DESC LIMIT 5").all())'
```

Expected: `scored` equals the number of title-filtered jobs, and the top matches are plausible for the resume.

If the run aborts (consecutive tool errors, step limit, or never calling `finish`), **do not patch around it in this plan.** Save the trace and report the abort reason and the last ~20 trace events to the user. That trace is the evidence for deciding whether to tune the prompt or fall back to approach A (fixed pipeline).

- [ ] **Step 6: Report**

Tell the user the smoke-run result: status, steps, wall time (first and last trace timestamps), counts from the query above, and anything odd in the trace.
