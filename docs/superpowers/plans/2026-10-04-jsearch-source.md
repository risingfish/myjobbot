# JSON Config and JSearch Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch the config file to JSON, then add JSearch saved searches as a second kind of job source with a code-enforced free-tier budget, so LinkedIn and other postings flow through the same scoring pipeline.

**Architecture:**
- **Part A** swaps the config parser and every reference to `config.yaml`.
- **Part B**, step 1: generalize "companies" to **sources**. Add a `source` column, rename the tools to `list_sources` and `fetch_jobs(source)`, and adjust the prompt wording.
- **Part B**, step 2: add header support to the HTTP client.
- **Part B**, step 3: add search sources. That means a JSearch adapter, an `api_calls` budget table, de-duplication against board jobs, refresh-or-serve logic in `fetch_jobs`, and logging.

**Tech Stack:** Node 24, TypeScript via tsx, zod 4, `node:sqlite`, vitest. No new dependencies; `yaml` is removed.

**Spec:** `docs/superpowers/specs/2026-10-04-jsearch-source-design.md`

---

## Rules for every task (habit-hooks, enforced by Claude Code hooks)

- **Size limits:** functions ≤ 12 lines, counting the signature and closing brace (this includes tests and nested arrows), ≤ 3 parameters, files ≤ 200 lines.
- **No** comments, `any`, `!`, or empty `catch`. No inferrable type annotations (`x = 5`, not `x: number = 5`).
- **Tests:** top-level `test()` only, no `describe`.
- **No dead code:** knip runs a production pass from `src/cli.ts`. Only export what another `src/` file imports. Test helpers live in `tests/helpers/`.
- **Transient findings:** findings that appear partway through a task resolve as later steps land. By each task's final step, `npm run check` prints `✅ Habit Hooks: automated checks passed.` Never snooze or silence a finding; fix the root cause.
- **Write files with Edit/Write**, not Bash heredocs, so the per-file hook runs.
- **Read each file before editing it.** Snippets show the intended end state.

Commands: `npm run check` (typecheck + vitest + habit-hooks); `tests/docker.sh` (container checks, needs Docker).

## File structure (new and changed)

```
src/config/load.ts          JSON parsing, YAML-migration error, JSEARCH_API_KEY requirement
src/config/schema.ts        searches, jsearch settings, cross-source validation, JSEARCH_API_KEY env
src/db/open.ts              idempotent migrations: source, publisher, api_calls
src/db/jobStore.ts          source-aware upsert and queries, board-duplicate lookup
src/db/apiCalls.ts          ApiCallLog: record, last call, monthly count, prune      (new)
src/http/client.ts          getJson(url, headers?)
src/jobs/job.ts             Job.ats may be "jsearch"; Job.publisher
src/jobs/company.ts         normalizeCompany()                                       (new)
src/sources/jsearch.ts      JSearch request + response mapping                       (new)
src/tools/sources.ts        Source union, configuredSources(), findSource(), FetchOutcome  (new)
src/tools/boardFetch.ts     board download + board_fetch log                         (new, Task 5)
src/tools/searchFetch.ts    due check, JSearch call, de-dup, search_fetch log         (new)
src/tools/searchBudget.ts   refreshBlocker(), requestsThisMonth()                    (new)
src/tools/jobLog.ts         withoutDescription() shared by both fetch logs           (new)
src/tools/fetchJobs.ts      fetch_jobs(source): board vs search, refreshed fields
src/tools/listSources.ts    list_sources (replaces listCompanies.ts)                 (renamed)
src/tools/context.ts        apiCalls, jsearchApiKey, FetchOutcome in run state
src/agent/prompt.ts         "sources" wording
src/app/run.ts              shared db for store + api calls, key, prune api_calls
examples/config.json        replaces examples/config.yaml
```

---

### Task 1: Config file is JSON

**Files:**
- Modify: `src/config/load.ts`, `tests/helpers/dataDir.ts`, `tests/config.test.ts`, `docker/entrypoint.sh`, `tests/docker.sh`, `README.md`, `docs/superpowers/specs/2026-10-03-myjobbot-design.md`, `docs/superpowers/specs/2026-10-04-docker-deployment-design.md`, `package.json`, `package-lock.json`
- Create: `examples/config.json`
- Delete: `examples/config.yaml`

- [ ] **Step 1: Switch the test helper to JSON and write the failing tests**

`tests/helpers/dataDir.ts` (full file):

```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const SAMPLE_CONFIG = {
  companies: [
    { name: "Stripe", ats: "greenhouse", slug: "stripe" },
    { name: "Palantir", ats: "lever", slug: "palantir" },
  ],
  preferences: "Remote US, senior backend",
};

export const TEST_ENV = {
  LLM_BASE_URL: "http://127.0.0.1:9/v1",
  LLM_MODEL: "test-model",
  LLM_API_KEY: "test-key",
  MYJOBBOT_LOG_DIR: mkdtempSync(join(tmpdir(), "myjobbot-log-")),
};

export function makeDataDir(config: object = SAMPLE_CONFIG): string {
  const dir = mkdtempSync(join(tmpdir(), "myjobbot-"));
  writeFileSync(join(dir, "config.json"), JSON.stringify(config));
  writeFileSync(join(dir, "resume.md"), "# Jane Doe\nSenior backend engineer, Go and TypeScript.\n");
  return dir;
}
```

In `tests/config.test.ts`, change the unknown-board test to:

```ts
test("loadConfig rejects an unknown board type", () => {
  const dir = makeDataDir({ companies: [{ name: "X", ats: "workday", slug: "x" }] });
  expect(() => loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dir })).toThrow(/ats/);
});
```

and append the following (add `import { rmSync, writeFileSync } from "node:fs";` and `import { join } from "node:path";` at the top):

```ts
test("loadConfig reports invalid JSON readably", () => {
  const dir = makeDataDir();
  writeFileSync(join(dir, "config.json"), "{ not json");
  expect(() => loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dir })).toThrow(/config.json is not valid JSON/);
});

test("loadConfig asks to convert a leftover config.yaml", () => {
  const dir = makeDataDir();
  rmSync(join(dir, "config.json"));
  writeFileSync(join(dir, "config.yaml"), "companies: []\n");
  expect(() => loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dir })).toThrow(/config is now JSON: convert .*config.yaml to .*config.json/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- config cli`
Expected: FAIL. The loader still reads `config.yaml`, so every `makeDataDir` test hits ENOENT.

- [ ] **Step 3: Implement JSON loading**

`src/config/load.ts` (full file):

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describeError } from "../errors.js";
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
  const file = fileConfigSchema.parse(readConfigJson(dataDir));
  return { env, file, resume: readText(dataDir, "resume.md"), dataDir };
}

function readConfigJson(dataDir: string): unknown {
  const jsonPath = join(dataDir, "config.json");
  const yamlPath = join(dataDir, "config.yaml");
  if (!existsSync(jsonPath) && existsSync(yamlPath)) {
    throw new Error(`config is now JSON: convert ${yamlPath} to ${jsonPath}`);
  }
  return parseJson(readText(dataDir, "config.json"));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`config.json is not valid JSON: ${describeError(error)}`, { cause: error });
  }
}

function readText(dir: string, name: string): string {
  return readFileSync(join(dir, name), "utf8");
}
```

- [ ] **Step 4: Replace the example config and remove `yaml`**

Create `examples/config.json`:

```json
{
  "companies": [
    { "name": "Stripe", "ats": "greenhouse", "slug": "stripe" },
    { "name": "Palantir", "ats": "lever", "slug": "palantir" },
    { "name": "OpenAI", "ats": "ashby", "slug": "openai" }
  ],
  "preferences": "Senior or staff backend / platform roles. Remote (US) preferred.",
  "match_threshold": 70
}
```

```bash
git rm -q examples/config.yaml
npm uninstall yaml
grep -c '@rolldown/binding-linux-x64-gnu' package-lock.json
```

The `grep` count must be non-zero. If it is 0 (the known npm optional-deps bug), run `npm cache clean --force && rm -rf node_modules package-lock.json && npm install --include=optional`, then re-check. `package.json` must differ only by the removed `yaml` line.

- [ ] **Step 5: Update the Docker checks**

- **`docker/entrypoint.sh`:** change `for file in config.yaml resume.md; do` to `for file in config.json resume.md; do`.
- **`tests/docker.sh`:**
  - change `cp examples/config.yaml examples/resume.md "$dir/"` to `cp examples/config.json examples/resume.md "$dir/"`
  - change `"missing /data/config.yaml"` to `"missing /data/config.json"`

- [ ] **Step 6: Update docs**

- **`README.md`:**
  - replace both `cp examples/config.yaml data/` with `cp examples/config.json data/`
  - in the first mermaid diagram, change `config.yaml + resume.md + env` to `config.json + resume.md + env`
  - change the heading `### Configuration knobs (\`data/config.yaml\`)` to `### Configuration knobs (\`data/config.json\`)`
- **`docs/superpowers/specs/2026-10-03-myjobbot-design.md`:** change `- **\`config.yaml\`**:` to `- **\`config.json\`** (JSON; see the JSearch spec for the format change):`.
- **`docs/superpowers/specs/2026-10-04-docker-deployment-design.md`:**
  - change `only: \`openai\`, \`tsx\`, \`yaml\`, \`zod\`` to `only: \`openai\`, \`tsx\`, \`zod\``
  - change both remaining `config.yaml` mentions to `config.json`

- [ ] **Step 7: Convert the local data config**

`data/` is gitignored, so this is local-only. Write `data/config.json` with the same content as `data/config.yaml`:

```json
{
  "companies": [{ "name": "Palantir", "ats": "lever", "slug": "palantir" }],
  "preferences": "Senior backend, remote US"
}
```

Then `mv data/config.yaml data/config.yaml.bak`.

- [ ] **Step 8: Verify and commit**

Run: `npm run check && tests/docker.sh`
Expected: all pass; habit-hooks clean; `all docker checks passed`.

```bash
git add -A src tests docker examples README.md docs/superpowers/specs package.json package-lock.json
git commit -m "Read config.json instead of config.yaml"
```

---

### Task 2: Config for searches and JSearch

**Files:**
- Modify: `src/config/schema.ts`, `src/config/load.ts`, `tests/config.test.ts`, `tests/helpers/config.ts`

- [ ] **Step 1: Write the failing tests**

Add a shared search fixture to `tests/helpers/config.ts`:

```ts
export const TEST_SEARCH = { name: "Backend remote", query: "senior backend engineer", remote_only: true };
```

In `tests/config.test.ts`:
- change the duplicate-names expectation to `toThrow(/names must be unique/)`
- import `TEST_SEARCH` from `./helpers/config.js` and `SAMPLE_CONFIG` from `./helpers/dataDir.js`
- append:

```ts
test("config applies search and JSearch defaults", () => {
  const config = testFileConfig({ searches: [TEST_SEARCH] });
  expect(config.searches[0]).toEqual({ ...TEST_SEARCH, country: "us" });
  expect(config.jsearch).toEqual({ monthly_request_cap: 190, refresh_hours: 24, date_posted: "3days" });
});

test("config accepts searches without companies", () => {
  expect(testFileConfig({ companies: [], searches: [TEST_SEARCH] }).companies).toEqual([]);
});

test("config needs at least one company or search", () => {
  expect(() => testFileConfig({ companies: [] })).toThrow(/at least one company or search/);
});

test("config rejects a search named like a company", () => {
  expect(() => testFileConfig({ searches: [{ ...TEST_SEARCH, name: "stripe" }] })).toThrow(/names must be unique/);
});

test("config rejects more searches than the JSearch budget allows", () => {
  const searches = Array.from({ length: 7 }, (_, index) => ({ ...TEST_SEARCH, name: `Search ${index}` }));
  expect(() => testFileConfig({ searches })).toThrow(/monthly_request_cap/);
  expect(testFileConfig({ searches: searches.slice(0, 6) }).searches).toHaveLength(6);
});

test("loadConfig requires JSEARCH_API_KEY when searches are configured", () => {
  const dir = makeDataDir({ ...SAMPLE_CONFIG, searches: [TEST_SEARCH] });
  expect(() => loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dir })).toThrow("JSEARCH_API_KEY is required when searches are configured");
  expect(loadConfig({ ...TEST_ENV, MYJOBBOT_DATA_DIR: dir, JSEARCH_API_KEY: "k" }).file.searches).toHaveLength(1);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- config`
Expected: FAIL. `searches` is unknown and stripped, so the defaults are missing and validation doesn't fire.

- [ ] **Step 3: Implement the schema**

In `src/config/schema.ts`:

- **Replace** the `companies` constant with nothing. Delete it; the array is defined inline below.
- **Add** after the `company` schema:

```ts
const search = z.object({
  name: z.string().min(1),
  query: z.string().min(1),
  remote_only: z.boolean().default(false),
  country: z.string().min(2).default("us"),
});

const jsearch = z.object({
  monthly_request_cap: z.number().int().min(1).default(190),
  refresh_hours: z.number().min(1).default(24),
  date_posted: z.enum(["today", "3days", "7days", "30days"]).default("3days"),
});

const HOURS_PER_MONTH = 30 * 24;
```

- **Replace** `fileConfigSchema` with:

```ts
export const fileConfigSchema = z
  .object({
    companies: z.array(company).default([]),
    searches: z.array(search).default([]),
    jsearch: jsearch.prefault({}),
    preferences: z.string().default(""),
    match_threshold: z.number().int().min(0).max(100).default(70),
    ghost_threshold_days: z.number().int().min(1).default(60),
    job_retention_days: z.number().int().min(1).default(90),
    title_filter: titleFilter.prefault({}),
    agent: agent.prefault({}),
    http: http.prefault({}),
  })
  .refine(hasAtLeastOneSource, { message: "configure at least one company or search" })
  .refine(hasUniqueSourceNames, { message: "company and search names must be unique" })
  .refine(fitsJsearchBudget, {
    message: "too many searches for jsearch.monthly_request_cap at this jsearch.refresh_hours",
  })
  .refine(hasLongerRetentionThanGhostThreshold, {
    message: "job_retention_days must be greater than ghost_threshold_days so repost history survives long enough to flag ghosts",
  });
```

- **Add** `JSEARCH_API_KEY: z.string().min(1).optional(),` to `envSchema`.
- **Add** these helpers (keep `hasUniqueNames` and `hasLongerRetentionThanGhostThreshold`):

```ts
interface SourceLists {
  companies: Array<{ name: string }>;
  searches: Array<{ name: string }>;
}

function hasAtLeastOneSource(config: SourceLists): boolean {
  return config.companies.length + config.searches.length > 0;
}

function hasUniqueSourceNames(config: SourceLists): boolean {
  return hasUniqueNames([...config.companies, ...config.searches]);
}

function fitsJsearchBudget(config: SourceLists & { jsearch: { monthly_request_cap: number; refresh_hours: number } }): boolean {
  const refreshesPerMonth = Math.ceil(HOURS_PER_MONTH / config.jsearch.refresh_hours);
  return config.searches.length * refreshesPerMonth <= config.jsearch.monthly_request_cap;
}
```

In `src/config/load.ts`, call `requireSearchKey(env, file);` in `loadConfig` right after `file` is parsed, and add:

```ts
function requireSearchKey(env: Env, file: FileConfig): void {
  if (file.searches.length > 0 && !env.JSEARCH_API_KEY) {
    throw new Error("JSEARCH_API_KEY is required when searches are configured");
  }
}
```

- [ ] **Step 4: Verify and commit**

Run: `npm run check`
Expected: all pass, habit-hooks clean.

```bash
git add src/config tests
git commit -m "Configure JSearch saved searches with a budget-feasibility check"
```

---

### Task 3: Companies become sources (boards only)

Behaviour for boards is unchanged. This task renames the agent-facing concept, adds the `source` column with a migration, and keys queries on it.

**Files:**
- Create: `src/tools/sources.ts`, `src/tools/listSources.ts`, `tests/listSources.test.ts`, `tests/migration.test.ts`
- Delete: `src/tools/listCompanies.ts`, `tests/listCompanies.test.ts`
- Modify: `src/db/open.ts`, `src/db/jobStore.ts`, `src/tools/fetchJobs.ts`, `src/tools/registry.ts`, `src/tools/finish.ts`, `src/agent/prompt.ts`
- Modify tests: `tests/helpers/tools.ts`, `tests/fetchJobs.test.ts`, `tests/jobStore.test.ts`, `tests/run.test.ts`, `tests/runIds.test.ts`, `tests/recovery.test.ts`, `tests/e2e.test.ts`, `tests/agent-loop.test.ts`

- [ ] **Step 1: Write the migration test**

`tests/migration.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { openDatabase } from "../src/db/open.js";

const PRE_SOURCE_SCHEMA = `
CREATE TABLE jobs (ats TEXT NOT NULL, job_id TEXT NOT NULL, company TEXT NOT NULL, title TEXT NOT NULL,
  normalized_title TEXT NOT NULL, location TEXT, department TEXT, team TEXT, workplace_type TEXT,
  is_remote INTEGER, compensation TEXT, url TEXT NOT NULL, posted_at TEXT, description TEXT,
  first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, scored_at TEXT, score INTEGER, reasons TEXT,
  gaps TEXT, emailed_at TEXT, PRIMARY KEY (ats, job_id));
INSERT INTO jobs (ats, job_id, company, title, normalized_title, url, first_seen, last_seen)
VALUES ('lever', 'old-1', 'Palantir', 'Backend Engineer', 'backend engineer', 'u',
  '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z');`;

function preSourceDatabase(): string {
  const path = join(mkdtempSync(join(tmpdir(), "myjobbot-db-")), "old.db");
  const db = new DatabaseSync(path);
  db.exec(PRE_SOURCE_SCHEMA);
  db.close();
  return path;
}

test("openDatabase adds the source column to an old database and backfills it", () => {
  const db = openDatabase(preSourceDatabase());
  expect({ ...db.prepare("SELECT source FROM jobs WHERE job_id = 'old-1'").get() }).toEqual({ source: "Palantir" });
});

test("openDatabase migrations are safe to run twice", () => {
  const path = preSourceDatabase();
  openDatabase(path).close();
  expect(() => openDatabase(path)).not.toThrow();
});
```

- [ ] **Step 2: Update the existing tests to the new names**

- **`tests/helpers/tools.ts`:** make the page schema loose, keyed on `source`:

```ts
const pageSchema = z.looseObject({
  source: z.string(),
  total_unscored: z.number(),
  jobs: z.array(z.looseObject({ job_id: z.string() })),
});

export async function fetchPage(context: ToolContext, source: string) {
  return pageSchema.parse(await invokeTool(context, "fetch_jobs", { source }));
}
```

- **`tests/fetchJobs.test.ts`:** in the first test change `company: "Stripe",` to `source: "Stripe",`. Change the unknown-company test to:

```ts
test("fetch_jobs rejects an unknown source", async () => {
  await expect(fetchPage(testContext(), "Initech")).rejects.toThrow('unknown source "Initech"');
});
```

- **`tests/jobStore.test.ts`:** every `store.upsertAll(jobs, seen)` call gains a third argument, `"Stripe"`.
- **`tests/run.test.ts`:**
  - the stale-job `upsertAll([stale], "2020-…")` gains `"Stripe"`
  - `toolCallsReply(["fetch_jobs", { company: "Stripe" }], …)` becomes `{ source: "Stripe" }`
- **`tests/runIds.test.ts` and `tests/recovery.test.ts`:** every `fetch_jobs` argument `{ company: "Stripe" }` becomes `{ source: "Stripe" }`.
- **`tests/e2e.test.ts`:** `toolCallReply("list_companies", {})` becomes `toolCallReply("list_sources", {})`, and both `{ company: "Stripe" }` become `{ source: "Stripe" }`.
- **`tests/agent-loop.test.ts`:** `toolCallReply("list_companies", {})` becomes `toolCallReply("list_sources", {})`.

Replace `tests/listCompanies.test.ts` with `tests/listSources.test.ts`:

```ts
import { expect, test } from "vitest";
import { greenhouseBoard } from "./helpers/boards.js";
import { testContext } from "./helpers/context.js";
import { fakeBoard, flakyBoard } from "./helpers/http.js";
import { fetchPage, invokeTool } from "./helpers/tools.js";

const UNFETCHED = { name: "Stripe", kind: "board", ats: "greenhouse", fetched: false };

function failingBoard() {
  return { getJson: () => Promise.reject(new Error("down")) };
}

test("list_sources returns each board with its kind, board type, and run progress", async () => {
  expect(await invokeTool(testContext(), "list_sources", {})).toEqual([UNFETCHED]);
});

test("list_sources flags fetch_failed when the cached fetch rejected", async () => {
  const context = testContext({ http: failingBoard() });
  await expect(invokeTool(context, "fetch_jobs", { source: "Stripe" })).rejects.toThrow();
  expect(await invokeTool(context, "list_sources", {})).toEqual([{ ...UNFETCHED, fetch_failed: true }]);
});

test("list_sources clears fetch_failed once a retry succeeds", async () => {
  const context = testContext({ http: flakyBoard(greenhouseBoard(["Backend Engineer", "Frontend Engineer"])) });
  await expect(invokeTool(context, "fetch_jobs", { source: "Stripe" })).rejects.toThrow();
  await invokeTool(context, "fetch_jobs", { source: "Stripe" });
  expect(await invokeTool(context, "list_sources", {})).toEqual([{ ...UNFETCHED, fetched: true, total_unscored: 2 }]);
  context.run.fetches.delete("Stripe");
  expect(await invokeTool(context, "list_sources", {})).toEqual([UNFETCHED]);
});

test("list_sources reports total_unscored once a board has been fetched", async () => {
  const context = testContext({ http: fakeBoard(greenhouseBoard(["Backend Engineer", "Frontend Engineer"])) });
  const page = await fetchPage(context, "Stripe");
  await invokeTool(context, "record_matches", { verdicts: [{ job_id: page.jobs[0]?.job_id, score: 80 }] });
  expect(await invokeTool(context, "list_sources", {})).toEqual([{ ...UNFETCHED, fetched: true, total_unscored: 1 }]);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. There is no `list_sources` tool, `fetch_jobs` rejects `source`, and the `source` column is missing.

- [ ] **Step 4: Migrate the database**

`src/db/open.ts`: keep `SCHEMA` as is. Add the following and use it in `openDatabase`:

```ts
const ADDED_COLUMNS = ["source TEXT"];
const AFTER_COLUMNS = `
UPDATE jobs SET source = company WHERE source IS NULL;
CREATE INDEX IF NOT EXISTS jobs_by_source ON jobs (source, scored_at);
`;

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  addMissingColumns(db);
  db.exec(AFTER_COLUMNS);
  return db;
}

function addMissingColumns(db: DatabaseSync): void {
  const existing = new Set(db.prepare("PRAGMA table_info(jobs)").all().map((column) => String(column.name)));
  for (const definition of ADDED_COLUMNS) {
    const [name = ""] = definition.split(" ");
    if (!existing.has(name)) db.exec(`ALTER TABLE jobs ADD COLUMN ${definition}`);
  }
}
```

- [ ] **Step 5: Make the store source-aware**

In `src/db/jobStore.ts`:

```ts
const UPSERT = `
INSERT INTO jobs (ats, job_id, company, source, title, normalized_title, location, department, team,
  workplace_type, is_remote, compensation, url, posted_at, description, first_seen, last_seen)
VALUES (:ats, :job_id, :company, :source, :title, :normalized_title, :location, :department, :team,
  :workplace_type, :is_remote, :compensation, :url, :posted_at, :description, :seen, :seen)
ON CONFLICT (ats, job_id) DO UPDATE SET
  company = excluded.company, source = excluded.source, title = excluded.title,
  normalized_title = excluded.normalized_title, location = excluded.location,
  department = excluded.department, team = excluded.team, workplace_type = excluded.workplace_type,
  is_remote = excluded.is_remote, compensation = excluded.compensation, url = excluded.url,
  posted_at = excluded.posted_at, description = excluded.description, last_seen = excluded.last_seen`;
const UNSCORED = "SELECT * FROM jobs WHERE source = ? AND last_seen = ? AND scored_at IS NULL ORDER BY job_id";
```

```ts
  upsertAll(jobs: Job[], seen: string, source: string): void {
    const statement = this.db.prepare(UPSERT);
    this.transaction(() => {
      for (const job of jobs) statement.run(toParams(job, seen, source));
    });
  }

  unscoredSince(source: string, seen: string): JobRow[] {
    return z.array(jobRow).parse(this.db.prepare(UNSCORED).all(source, seen));
  }
```

```ts
function toParams(job: Job, seen: string, source: string): Record<string, string | number | null> {
  return {
    ats: job.ats, job_id: job.jobId, company: job.company, source, title: job.title,
    normalized_title: normalizeTitle(job.title), location: job.location, department: job.department,
    team: job.team, workplace_type: job.workplaceType, is_remote: toFlag(job.isRemote),
    compensation: job.compensation, url: job.url, posted_at: job.postedAt, description: job.description, seen,
  };
}
```

- [ ] **Step 6: Add sources and rename the tools**

`src/tools/sources.ts`:

```ts
import type { FileConfig } from "../config/schema.js";
import type { ToolContext } from "./context.js";

type Company = FileConfig["companies"][number];
export type Source = { kind: "board"; name: string; company: Company };

export function configuredSources(context: ToolContext): Source[] {
  return context.config.companies.map((company) => ({ kind: "board" as const, name: company.name, company }));
}

export function findSource(context: ToolContext, name: string): Source {
  const wanted = name.trim().toLowerCase();
  const source = configuredSources(context).find((candidate) => candidate.name.toLowerCase() === wanted);
  if (!source) throw new Error(`unknown source "${name}"; call list_sources for valid names`);
  return source;
}
```

`src/tools/fetchJobs.ts` (full file):

```ts
import { z } from "zod";
import type { Job } from "../jobs/job.js";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import { fetcherFor } from "../sources/index.js";
import type { ToolContext } from "./context.js";
import { summarizeJob } from "./jobSummary.js";
import { findSource, type Source } from "./sources.js";
import { defineTool, type Tool } from "./tool.js";

const PAGE_SIZE = 25;
const schema = z.object({ source: z.string().describe("Source name exactly as returned by list_sources") });

export function fetchJobsTool(context: ToolContext): Tool {
  return defineTool({
    name: "fetch_jobs",
    description: `Return up to ${PAGE_SIZE} unscored jobs from a source (a company board or a saved search) plus total_unscored. Score them with record_matches, then call again until total_unscored is 0.`,
    schema,
    run: ({ source }) => jobPage(context, findSource(context, source)),
  });
}

export function unscoredJobs(context: ToolContext, source: Source, seen: string) {
  const filter = context.config.title_filter;
  return context.store.unscoredSince(source.name, seen).filter((row) => passesTitleFilter(row.title, filter));
}

async function jobPage(context: ToolContext, source: Source) {
  const seen = await fetchOnce(context, source);
  const unscored = unscoredJobs(context, source, seen);
  const jobs = unscored.slice(0, PAGE_SIZE).map((row) => summarizeJob(context, row));
  return { source: source.name, total_unscored: unscored.length, jobs };
}

function fetchOnce(context: ToolContext, source: Source): Promise<string> {
  const cached = context.run.fetches.get(source.name);
  if (cached) return cached;
  const pending = fetchAndStore(context, source);
  context.run.fetches.set(source.name, pending);
  pending.then(() => onFetchSuccess(context, source), () => onFetchFailure(context, source));
  return pending;
}

function onFetchSuccess(context: ToolContext, source: Source): void {
  context.run.failedFetches.delete(source.name);
}

function onFetchFailure(context: ToolContext, source: Source): void {
  context.run.fetches.delete(source.name);
  context.run.failedFetches.add(source.name);
}

async function fetchAndStore(context: ToolContext, source: Source): Promise<string> {
  const jobs = await fetcherFor(source.company.ats)(source.company, context.http);
  logBoardFetch(context, source, jobs);
  const seen = context.now().toISOString();
  context.store.upsertAll(jobs, seen, source.name);
  return seen;
}

function logBoardFetch(context: ToolContext, source: Source, jobs: Job[]): void {
  const { name, ats, slug } = source.company;
  const logged = jobs.map(({ description: _description, ...job }) => job);
  context.jobLog.write({ type: "board_fetch", source: source.name, company: name, ats, slug, job_count: jobs.length, jobs: logged });
}
```

`src/tools/listSources.ts` (replaces `listCompanies.ts`; `git rm src/tools/listCompanies.ts tests/listCompanies.test.ts`):

```ts
import { z } from "zod";
import type { ToolContext } from "./context.js";
import { unscoredJobs } from "./fetchJobs.js";
import { configuredSources, type Source } from "./sources.js";
import { defineTool, type Tool } from "./tool.js";

export function listSourcesTool(context: ToolContext): Tool {
  return defineTool({
    name: "list_sources",
    description: "List the sources you can fetch jobs from (company boards and saved searches), with progress for this run.",
    schema: z.object({}),
    run: () => Promise.all(configuredSources(context).map((source) => sourceStatus(context, source))),
  });
}

function describeSource(source: Source) {
  return { name: source.name, kind: source.kind, ats: source.company.ats };
}

function notFetched(context: ToolContext, source: Source) {
  if (context.run.failedFetches.has(source.name)) return { ...describeSource(source), fetched: false, fetch_failed: true };
  return { ...describeSource(source), fetched: false };
}

async function sourceStatus(context: ToolContext, source: Source) {
  const cached = context.run.fetches.get(source.name);
  return cached ? fetchedStatus(context, source, cached) : notFetched(context, source);
}

async function fetchedStatus(context: ToolContext, source: Source, cached: Promise<string>) {
  try {
    const seen = await cached;
    return { ...describeSource(source), fetched: true, total_unscored: unscoredJobs(context, source, seen).length };
  } catch {
    return notFetched(context, source);
  }
}
```

In `src/tools/registry.ts`, replace the `listCompaniesTool` import and call with `listSourcesTool` from `./listSources.js`.

In `src/tools/finish.ts`, change the description to `"End the run. Call only when every source has total_unscored 0."`

`src/agent/prompt.ts`: replace `NUDGE`, `COMPACTION_NOTICE` and the five numbered steps:

```ts
export const NUDGE = "Respond only with tool calls. Call finish when every source has total_unscored 0.";
export const COMPACTION_NOTICE =
  "Earlier tool calls and results were removed to save context. Call list_sources to see each source's progress, then continue.";
```

```
Work only through tool calls:
1. Call list_sources. Sources are company job boards and saved job searches.
2. For each source call fetch_jobs. It returns up to 25 unscored jobs and total_unscored.
3. Score every returned job from 0 to 100 for fit, then save the whole page with one record_matches call.
4. Call fetch_jobs again for the same source until total_unscored is 0, then move on to the next source.
5. When every source is done, call finish with a one-paragraph summary.
```

- [ ] **Step 7: Verify and commit**

Run: `npm run check`
Expected: all pass, habit-hooks clean.

```bash
git add -A src tests
git commit -m "Generalize companies to sources: list_sources, fetch_jobs(source), source column"
```

---

### Task 4: HTTP requests can carry headers

**Files:**
- Modify: `src/http/client.ts`, `tests/helpers/http.ts`, `tests/httpClient.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/helpers/http.ts`, make `scriptedFetch` record the request init too:

```ts
export function scriptedFetch(responses: Response[]) {
  const urls: string[] = [];
  const inits: RequestInit[] = [];
  const queue = [...responses];
  const fetchFn = async (url: string, init: RequestInit): Promise<Response> => {
    urls.push(url);
    inits.push(init);
    const response = queue.shift();
    if (!response) throw new Error("scripted fetch ran out of responses");
    return response;
  };
  return { fetchFn, urls, inits };
}
```

Append to `tests/httpClient.test.ts`. The file's `client()` helper must also return `inits` from `scriptedFetch`; add `inits` to its return object.

```ts
test("HttpClient sends request headers when given", async () => {
  const { http, inits } = client([jsonResponse({ ok: true })]);
  await http.getJson(URL_A, { "x-api-key": "secret" });
  expect(inits[0]?.headers).toEqual({ "x-api-key": "secret" });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- httpClient`
Expected: FAIL. `headers` is `undefined`.

- [ ] **Step 3: Implement**

In `src/http/client.ts`:

```ts
export interface JsonGetter {
  getJson(url: string, headers?: Record<string, string>): Promise<unknown>;
}
```

```ts
  async getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await this.withUrl(url, () => this.send(url, headers));
      if (response.ok) return this.withUrl(url, () => response.json());
      await response.body?.cancel();
      if (!this.shouldRetry(response.status, attempt)) throw new Error(`GET ${url} failed with HTTP ${response.status}`);
      await this.deps.clock.sleep(this.backoffMs(response, attempt));
    }
  }
```

```ts
  private send(url: string, headers: Record<string, string>): Promise<Response> {
    return this.limiter.schedule(new URL(url).host, () => this.fetchWithTimeout(url, headers));
  }

  private fetchWithTimeout(url: string, headers: Record<string, string>): Promise<Response> {
    const signal = AbortSignal.timeout(this.deps.config.timeout_s * MS_PER_SECOND);
    return this.deps.fetchFn(url, { signal, headers });
  }
```

- [ ] **Step 4: Verify and commit**

Run: `npm run check && tests/docker.sh`
Expected: all pass.

```bash
git add src/http tests
git commit -m "Let HTTP requests carry headers"
```

---

### Task 5: JSearch search sources

**Files:**
- Create: `src/jobs/company.ts`, `src/db/apiCalls.ts`, `src/sources/jsearch.ts`, `src/tools/boardFetch.ts`, `src/tools/searchFetch.ts`, `src/tools/searchBudget.ts`, `src/tools/jobLog.ts`
- Modify: `src/jobs/job.ts`, `src/db/open.ts`, `src/db/jobStore.ts`, `src/tools/sources.ts`, `src/tools/fetchJobs.ts`, `src/tools/listSources.ts`, `src/tools/context.ts`, `src/app/run.ts`
- Tests: `tests/fixtures/jsearch.json`, `tests/company.test.ts`, `tests/apiCalls.test.ts`, `tests/jsearch.test.ts`, `tests/searchSources.test.ts`, `tests/searchE2e.test.ts`; modify `tests/helpers/http.ts`, `tests/helpers/context.ts`, `tests/migration.test.ts`

- [ ] **Step 1: Fixture and test helpers**

`tests/fixtures/jsearch.json`:

```json
{
  "status": "OK",
  "request_id": "test-request",
  "data": [
    {
      "job_id": "js-linkedin-1",
      "employer_name": "Acme Robotics, Inc.",
      "job_title": "Senior Backend Engineer",
      "job_apply_link": "https://www.linkedin.com/jobs/view/1",
      "job_city": "Austin",
      "job_state": "TX",
      "job_country": "US",
      "job_is_remote": true,
      "work_arrangement": "remote",
      "job_salary_string": "$170K-$210K a year",
      "job_posted_at_datetime_utc": "2026-10-02T15:00:00.000Z",
      "job_description": "Build APIs in Go.",
      "job_publisher": "LinkedIn"
    },
    {
      "job_id": "js-dup-stripe",
      "employer_name": "Stripe, Inc.",
      "job_title": "Backend Engineer",
      "job_apply_link": "https://stripe.com/jobs/1000",
      "job_city": null,
      "job_state": null,
      "job_country": "US",
      "job_is_remote": false,
      "job_publisher": "Stripe Careers"
    }
  ]
}
```

Append to `tests/helpers/http.ts`:

```ts
export interface RecordedRequest {
  url: string;
  headers: Record<string, string>;
}

export function routedHttp(routes: Record<string, unknown>): JsonGetter & { requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  return {
    requests,
    getJson: async (url, headers = {}) => {
      requests.push({ url, headers });
      const body = routes[new URL(url).host];
      if (body === undefined) throw new Error(`no fake route for ${url}`);
      return structuredClone(body);
    },
  };
}
```

`tests/helpers/context.ts` (full file):

```ts
import { ApiCallLog } from "../../src/db/apiCalls.js";
import { JobStore } from "../../src/db/jobStore.js";
import { openDatabase } from "../../src/db/open.js";
import { newRunState, type ToolContext } from "../../src/tools/context.js";
import { testFileConfig } from "./config.js";
import { memoryTrace } from "./trace.js";

export const TEST_NOW = new Date("2026-10-03T12:00:00.000Z");

export function testContext(overrides: Partial<ToolContext> = {}): ToolContext {
  const db = openDatabase(":memory:");
  return {
    config: testFileConfig(), run: newRunState(),
    store: new JobStore(db), apiCalls: new ApiCallLog(db),
    http: { getJson: () => Promise.reject(new Error("unexpected HTTP request in test")) },
    now: () => TEST_NOW, jobLog: memoryTrace(), jsearchApiKey: "test-jsearch-key",
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the failing unit tests**

`tests/company.test.ts`:

```ts
import { expect, test } from "vitest";
import { normalizeCompany } from "../src/jobs/company.js";

test("normalizeCompany drops punctuation and legal suffixes", () => {
  expect(normalizeCompany("Stripe, Inc.")).toBe("stripe");
  expect(normalizeCompany("Acme Robotics LLC")).toBe("acme robotics");
  expect(normalizeCompany("Foo Corp.")).toBe("foo");
});

test("normalizeCompany keeps a name that is only a suffix word", () => {
  expect(normalizeCompany("Co")).toBe("co");
});
```

`tests/apiCalls.test.ts`:

```ts
import { expect, test } from "vitest";
import { ApiCallLog } from "../src/db/apiCalls.js";
import { openDatabase } from "../src/db/open.js";

function seededCalls(): ApiCallLog {
  const calls = new ApiCallLog(openDatabase(":memory:"));
  calls.record("jsearch", "A", "2026-09-30T23:00:00.000Z");
  calls.record("jsearch", "A", "2026-10-02T10:00:00.000Z");
  calls.record("jsearch", "B", "2026-10-03T10:00:00.000Z");
  return calls;
}

test("ApiCallLog counts calls since a time and finds each source's last call", () => {
  const calls = seededCalls();
  expect(calls.countSince("jsearch", "2026-10-01T00:00:00.000Z")).toBe(2);
  expect(calls.lastCallAt("jsearch", "A")).toBe("2026-10-02T10:00:00.000Z");
  expect(calls.lastCallAt("jsearch", "C")).toBeNull();
});

test("ApiCallLog prunes calls before a cutoff", () => {
  const calls = seededCalls();
  calls.pruneBefore("2026-10-01T00:00:00.000Z");
  expect(calls.countSince("jsearch", "2000-01-01T00:00:00.000Z")).toBe(2);
});
```

`tests/jsearch.test.ts`:

```ts
import { expect, test } from "vitest";
import { fetchJsearch } from "../src/sources/jsearch.js";
import { TEST_SEARCH, testFileConfig } from "./helpers/config.js";
import { loadFixture } from "./helpers/fixtures.js";
import { routedHttp } from "./helpers/http.js";

const HOST = "api.openwebninja.com";

function request(overrides: object = {}) {
  const config = testFileConfig({ searches: [{ ...TEST_SEARCH, ...overrides }] });
  const search = config.searches[0];
  if (!search) throw new Error("test search missing");
  return { search, settings: config.jsearch, apiKey: "secret-key" };
}

test("fetchJsearch requests the search with the API key header", async () => {
  const http = routedHttp({ [HOST]: loadFixture("jsearch.json") });
  await fetchJsearch(request(), http);
  expect(http.requests[0]?.headers).toEqual({ "x-api-key": "secret-key" });
  const url = new URL(http.requests[0]?.url ?? "");
  expect(`${url.origin}${url.pathname}`).toBe("https://api.openwebninja.com/jsearch/search-v2");
  expect(Object.fromEntries(url.searchParams)).toEqual({ query: "senior backend engineer", country: "us", date_posted: "3days", work_from_home: "true" });
});

test("fetchJsearch omits work_from_home unless the search is remote-only", async () => {
  const http = routedHttp({ [HOST]: loadFixture("jsearch.json") });
  await fetchJsearch(request({ remote_only: false }), http);
  expect(new URL(http.requests[0]?.url ?? "").searchParams.has("work_from_home")).toBe(false);
});

test("fetchJsearch maps results to jobs", async () => {
  const jobs = await fetchJsearch(request(), routedHttp({ [HOST]: loadFixture("jsearch.json") }));
  expect(jobs[0]).toMatchObject({
    ats: "jsearch", jobId: "js-linkedin-1", company: "Acme Robotics, Inc.", title: "Senior Backend Engineer",
    url: "https://www.linkedin.com/jobs/view/1", location: "Austin, TX, US", isRemote: true, workplaceType: "remote",
    compensation: "$170K-$210K a year", postedAt: "2026-10-02T15:00:00.000Z", publisher: "LinkedIn",
  });
  expect(jobs[1]).toMatchObject({ location: "US", isRemote: false, workplaceType: null, publisher: "Stripe Careers" });
});

test("fetchJsearch accepts results nested under data.jobs", async () => {
  const job = { job_id: "n1", employer_name: "Nested Co", job_title: "Backend Engineer", job_apply_link: "https://example.com/n1" };
  const jobs = await fetchJsearch(request(), routedHttp({ [HOST]: { data: { jobs: [job] } } }));
  expect(jobs.map((entry) => entry.jobId)).toEqual(["n1"]);
});

test("fetchJsearch explains a refused request", async () => {
  const http = { getJson: () => Promise.reject(new Error("GET https://api.openwebninja.com/jsearch/search-v2?query=x failed with HTTP 401")) };
  await expect(fetchJsearch(request(), http)).rejects.toThrow("JSearch refused the request (HTTP 401); check JSEARCH_API_KEY and that the account is subscribed to JSearch");
});
```

Append to `tests/migration.test.ts`:

```ts
test("openDatabase adds the publisher column and the api_calls table", () => {
  const db = openDatabase(preSourceDatabase());
  const columns = db.prepare("PRAGMA table_info(jobs)").all().map((column) => column.name);
  expect(columns).toContain("publisher");
  expect({ ...db.prepare("SELECT COUNT(*) AS count FROM api_calls").get() }).toEqual({ count: 0 });
});
```

- [ ] **Step 3: Write the failing behaviour tests**

`tests/searchSources.test.ts`:

```ts
import { expect, test } from "vitest";
import { newRunState, type ToolContext } from "../src/tools/context.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { TEST_SEARCH, testFileConfig } from "./helpers/config.js";
import { TEST_NOW, testContext } from "./helpers/context.js";
import { loadFixture } from "./helpers/fixtures.js";
import { routedHttp } from "./helpers/http.js";
import { fetchPage, invokeTool } from "./helpers/tools.js";
import { memoryTrace } from "./helpers/trace.js";

const JSEARCH_HOST = "api.openwebninja.com";
const SEARCH_NAME = TEST_SEARCH.name;

function searchContext(overrides: Partial<ToolContext> = {}) {
  const http = routedHttp({ [JSEARCH_HOST]: loadFixture("jsearch.json"), "boards-api.greenhouse.io": greenhouseBoard(["Backend Engineer"]) });
  const context = testContext({ config: testFileConfig({ searches: [TEST_SEARCH] }), http, ...overrides });
  const jsearchRequests = () => http.requests.filter((sent) => new URL(sent.url).host === JSEARCH_HOST);
  return { context, jsearchRequests };
}

test("fetch_jobs on a search calls JSearch once per run and serves its jobs", async () => {
  const { context, jsearchRequests } = searchContext();
  expect(await fetchPage(context, SEARCH_NAME)).toMatchObject({ source: SEARCH_NAME, total_unscored: 2, refreshed: true });
  await fetchPage(context, SEARCH_NAME);
  expect(jsearchRequests()).toHaveLength(1);
});

test("a search is not refreshed again within refresh_hours", async () => {
  const { context, jsearchRequests } = searchContext();
  await fetchPage(context, SEARCH_NAME);
  const page = await fetchPage({ ...context, run: newRunState() }, SEARCH_NAME);
  expect(page).toMatchObject({ total_unscored: 2, refreshed: false, refresh_note: "refreshed 0h ago; next refresh in 24h" });
  expect(jsearchRequests()).toHaveLength(1);
});

test("a search is not refreshed once the monthly budget is used", async () => {
  const { context, jsearchRequests } = searchContext();
  for (let index = 0; index < 190; index += 1) context.apiCalls.record("jsearch", "other", TEST_NOW.toISOString());
  const page = await fetchPage(context, SEARCH_NAME);
  expect(page).toMatchObject({ total_unscored: 0, refreshed: false, refresh_note: "monthly JSearch budget used (190/190)" });
  expect(jsearchRequests()).toHaveLength(0);
});

test("JSearch results that duplicate a company-board job are skipped", async () => {
  const { context } = searchContext();
  await fetchPage(context, "Stripe");
  expect((await fetchPage(context, SEARCH_NAME)).jobs.map((job) => job.job_id)).toEqual(["js-linkedin-1"]);
});

test("each JSearch request is logged with its query and skipped duplicates", async () => {
  const jobLog = memoryTrace();
  const { context } = searchContext({ jobLog });
  await fetchPage(context, "Stripe");
  await fetchPage(context, SEARCH_NAME);
  expect(jobLog.events.at(-1)).toMatchObject({
    type: "search_fetch", source: SEARCH_NAME, query: "senior backend engineer", requests_this_month: 1,
    job_count: 1, skipped_duplicates: 1, params: { country: "us", date_posted: "3days", work_from_home: "true" },
  });
});

test("list_sources shows saved searches next to boards", async () => {
  const { context } = searchContext();
  await fetchPage(context, SEARCH_NAME);
  expect(await invokeTool(context, "list_sources", {})).toEqual([
    { name: "Stripe", kind: "board", ats: "greenhouse", fetched: false },
    { name: SEARCH_NAME, kind: "search", fetched: true, total_unscored: 2 },
  ]);
});
```

`tests/searchE2e.test.ts`:

```ts
import { join } from "node:path";
import { expect, test } from "vitest";
import { runOnce } from "../src/app/run.js";
import { openDatabase } from "../src/db/open.js";
import { greenhouseBoard } from "./helpers/boards.js";
import { scriptedChat, toolCallReply } from "./helpers/chat.js";
import { TEST_SEARCH } from "./helpers/config.js";
import { makeDataDir, TEST_ENV } from "./helpers/dataDir.js";
import { loadFixture } from "./helpers/fixtures.js";
import { routedHttp } from "./helpers/http.js";

const CONFIG = { companies: [{ name: "Stripe", ats: "greenhouse", slug: "stripe" }], searches: [TEST_SEARCH] };

const FIRST_RUN = [
  toolCallReply("list_sources", {}),
  toolCallReply("fetch_jobs", { source: "Stripe" }),
  toolCallReply("record_matches", { verdicts: [{ job_id: "1000", score: 80 }] }),
  toolCallReply("fetch_jobs", { source: TEST_SEARCH.name }),
  toolCallReply("record_matches", { verdicts: [{ job_id: "js-linkedin-1", score: 85 }] }),
  toolCallReply("finish", { summary: "Scored a board and a search." }),
];
const SECOND_RUN = [toolCallReply("fetch_jobs", { source: TEST_SEARCH.name }), toolCallReply("finish", { summary: "Nothing new." })];

function scoredRows(dataDir: string) {
  const sql = "SELECT job_id, source, score FROM jobs WHERE score IS NOT NULL ORDER BY job_id";
  return openDatabase(join(dataDir, "myjobbot.db")).prepare(sql).all().map((row) => ({ ...row }));
}

test("a run scores a board and a saved search, and the next run reuses the search", async () => {
  const dataDir = makeDataDir(CONFIG);
  const http = routedHttp({ "api.openwebninja.com": loadFixture("jsearch.json"), "boards-api.greenhouse.io": greenhouseBoard(["Backend Engineer"]) });
  const env = { ...TEST_ENV, JSEARCH_API_KEY: "secret-key", MYJOBBOT_DATA_DIR: dataDir };
  expect(await runOnce(env, { chat: scriptedChat(FIRST_RUN).chat, http })).toMatchObject({ status: "finished" });
  expect(await runOnce(env, { chat: scriptedChat(SECOND_RUN).chat, http })).toMatchObject({ status: "finished" });
  expect(http.requests.filter((sent) => sent.url.includes("openwebninja"))).toHaveLength(1);
  expect(scoredRows(dataDir)).toEqual([{ job_id: "1000", source: "Stripe", score: 80 }, { job_id: "js-linkedin-1", source: TEST_SEARCH.name, score: 85 }]);
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `npm test`
Expected: FAIL. `src/jobs/company.js`, `src/db/apiCalls.js` and `src/sources/jsearch.js` cannot be resolved. `ToolContext` has no `apiCalls`/`jsearchApiKey`. Searches aren't sources yet.

- [ ] **Step 5: Job model, company names, database**

`src/jobs/job.ts`:
- change `ats: Ats;` to `ats: Ats | "jsearch";`
- add `publisher: string | null;` after `description` in `Job`
- add `publisher: null,` to `NO_DETAILS`

`src/jobs/company.ts`:

```ts
import { normalizeTitle } from "./normalize.js";

const LEGAL_SUFFIXES = new Set(["inc", "llc", "ltd", "corp", "corporation", "co", "gmbh", "plc"]);

export function normalizeCompany(name: string): string {
  const words = normalizeTitle(name).split(" ");
  while (words.length > 1 && LEGAL_SUFFIXES.has(words.at(-1) ?? "")) words.pop();
  return words.join(" ");
}
```

`src/db/open.ts`:
- append to `SCHEMA` (inside the template string, after the existing index):

```sql
CREATE TABLE IF NOT EXISTS api_calls (api TEXT NOT NULL, source TEXT NOT NULL, called_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS api_calls_by_api_time ON api_calls (api, called_at);
```

- change `ADDED_COLUMNS` to `["source TEXT", "publisher TEXT"]`

`src/db/apiCalls.ts`:

```ts
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const RECORD = "INSERT INTO api_calls (api, source, called_at) VALUES (?, ?, ?)";
const LAST_CALL = "SELECT MAX(called_at) AS last FROM api_calls WHERE api = ? AND source = ?";
const COUNT_SINCE = "SELECT COUNT(*) AS count FROM api_calls WHERE api = ? AND called_at >= ?";
const PRUNE = "DELETE FROM api_calls WHERE called_at < ?";

export class ApiCallLog {
  constructor(private readonly db: DatabaseSync) {}

  record(api: string, source: string, calledAt: string): void {
    this.db.prepare(RECORD).run(api, source, calledAt);
  }

  lastCallAt(api: string, source: string): string | null {
    return z.object({ last: z.string().nullable() }).parse(this.db.prepare(LAST_CALL).get(api, source)).last;
  }

  countSince(api: string, since: string): number {
    return z.object({ count: z.number() }).parse(this.db.prepare(COUNT_SINCE).get(api, since)).count;
  }

  pruneBefore(cutoff: string): void {
    this.db.prepare(PRUNE).run(cutoff);
  }
}
```

`src/db/jobStore.ts`:
- in `UPSERT`, add `publisher` to the column list after `description`, `:publisher` to the values after `:description`, and `publisher = excluded.publisher,` before `last_seen = excluded.last_seen`
- in `toParams`, add `publisher: job.publisher,` after `description: job.description,`
- add these constants and methods:

```ts
const UNSCORED_FOR_SOURCE = "SELECT * FROM jobs WHERE source = ? AND scored_at IS NULL ORDER BY job_id";
const BOARD_COMPANIES_WITH_TITLE = "SELECT DISTINCT company FROM jobs WHERE ats != 'jsearch' AND normalized_title = ?";
```

```ts
  unscoredForSource(source: string): JobRow[] {
    return z.array(jobRow).parse(this.db.prepare(UNSCORED_FOR_SOURCE).all(source));
  }

  boardCompaniesWithTitle(normalizedTitle: string): string[] {
    const rows = this.db.prepare(BOARD_COMPANIES_WITH_TITLE).all(normalizedTitle);
    return z.array(z.object({ company: z.string() })).parse(rows).map((row) => row.company);
  }
```

- [ ] **Step 6: The JSearch adapter**

`src/sources/jsearch.ts`:

```ts
import { z } from "zod";
import type { FileConfig } from "../config/schema.js";
import { describeError } from "../errors.js";
import type { JsonGetter } from "../http/client.js";
import { makeJob, type Job } from "../jobs/job.js";
import { optionalDate, optionalFlag, optionalText } from "./fields.js";

type Search = FileConfig["searches"][number];
type JsearchSettings = FileConfig["jsearch"];

const ENDPOINT = "https://api.openwebninja.com/jsearch/search-v2";

const result = z.object({
  job_id: z.string(),
  employer_name: z.string(),
  job_title: z.string(),
  job_apply_link: z.string(),
  job_city: optionalText,
  job_state: optionalText,
  job_country: optionalText,
  job_is_remote: optionalFlag,
  work_arrangement: optionalText,
  job_salary_string: optionalText,
  job_posted_at_datetime_utc: optionalDate,
  job_description: optionalText,
  job_publisher: optionalText,
});
const results = z.array(result);
const response = z.union([z.object({ data: results }), z.object({ data: z.object({ jobs: results }) })]);

interface SearchRequest {
  search: Search;
  settings: JsearchSettings;
  apiKey: string;
}

export function searchParams(search: Search, settings: JsearchSettings): Record<string, string> {
  const params: Record<string, string> = { query: search.query, country: search.country, date_posted: settings.date_posted };
  if (search.remote_only) params.work_from_home = "true";
  return params;
}

export async function fetchJsearch(request: SearchRequest, http: JsonGetter): Promise<Job[]> {
  const url = `${ENDPOINT}?${new URLSearchParams(searchParams(request.search, request.settings))}`;
  const body = await withKeyHint(() => http.getJson(url, { "x-api-key": request.apiKey }));
  return jobsIn(response.parse(body)).map(toJob);
}

function jobsIn(parsed: z.infer<typeof response>): Array<z.infer<typeof result>> {
  return Array.isArray(parsed.data) ? parsed.data : parsed.data.jobs;
}

async function withKeyHint<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const status = /HTTP (401|403)/.exec(describeError(error))?.[1];
    if (status) throw new Error(`JSearch refused the request (HTTP ${status}); check JSEARCH_API_KEY and that the account is subscribed to JSearch`, { cause: error });
    throw error;
  }
}

function toJob(post: z.infer<typeof result>): Job {
  const location = [post.job_city, post.job_state, post.job_country].filter((part) => part !== null).join(", ") || null;
  return makeJob(
    { ats: "jsearch", jobId: post.job_id, company: post.employer_name, title: post.job_title, url: post.job_apply_link },
    {
      location, isRemote: post.job_is_remote, workplaceType: post.work_arrangement, compensation: post.job_salary_string,
      postedAt: post.job_posted_at_datetime_utc, description: post.job_description, publisher: post.job_publisher,
    },
  );
}
```

`searchParams` is exported because `searchFetch.ts` logs the parameters.

- [ ] **Step 7: Sources, budget, and the two fetch paths**

`src/tools/sources.ts` (full file):

```ts
import type { FileConfig } from "../config/schema.js";
import type { ToolContext } from "./context.js";

export type Company = FileConfig["companies"][number];
export type Search = FileConfig["searches"][number];
export type Source = { kind: "board"; name: string; company: Company } | { kind: "search"; name: string; search: Search };

export interface FetchOutcome {
  seen: string | null;
  note: string | null;
}

export function configuredSources(context: ToolContext): Source[] {
  const boards = context.config.companies.map((company) => ({ kind: "board" as const, name: company.name, company }));
  const searches = context.config.searches.map((search) => ({ kind: "search" as const, name: search.name, search }));
  return [...boards, ...searches];
}

export function findSource(context: ToolContext, name: string): Source {
  const wanted = name.trim().toLowerCase();
  const source = configuredSources(context).find((candidate) => candidate.name.toLowerCase() === wanted);
  if (!source) throw new Error(`unknown source "${name}"; call list_sources for valid names`);
  return source;
}
```

`src/tools/jobLog.ts`:

```ts
import type { Job } from "../jobs/job.js";

export function withoutDescription(job: Job): Omit<Job, "description"> {
  const { description: _description, ...rest } = job;
  return rest;
}
```

`src/tools/boardFetch.ts`:

```ts
import type { Job } from "../jobs/job.js";
import { fetcherFor } from "../sources/index.js";
import type { ToolContext } from "./context.js";
import { withoutDescription } from "./jobLog.js";
import type { Company, FetchOutcome } from "./sources.js";

export async function fetchBoard(context: ToolContext, company: Company): Promise<FetchOutcome> {
  const jobs = await fetcherFor(company.ats)(company, context.http);
  logBoardFetch(context, company, jobs);
  const seen = context.now().toISOString();
  context.store.upsertAll(jobs, seen, company.name);
  return { seen, note: null };
}

function logBoardFetch(context: ToolContext, company: Company, jobs: Job[]): void {
  const { name, ats, slug } = company;
  const logged = jobs.map(withoutDescription);
  context.jobLog.write({ type: "board_fetch", source: name, company: name, ats, slug, job_count: jobs.length, jobs: logged });
}
```

`src/tools/searchBudget.ts`:

```ts
import type { ToolContext } from "./context.js";

const JSEARCH = "jsearch";
const MS_PER_HOUR = 3_600_000;

export function refreshBlocker(context: ToolContext, sourceName: string): string | null {
  const used = requestsThisMonth(context);
  const cap = context.config.jsearch.monthly_request_cap;
  if (used >= cap) return `monthly JSearch budget used (${used}/${cap})`;
  return tooRecent(context, sourceName);
}

export function requestsThisMonth(context: ToolContext): number {
  return context.apiCalls.countSince(JSEARCH, startOfMonth(context.now()).toISOString());
}

function tooRecent(context: ToolContext, sourceName: string): string | null {
  const last = context.apiCalls.lastCallAt(JSEARCH, sourceName);
  if (!last) return null;
  const ageHours = (context.now().getTime() - Date.parse(last)) / MS_PER_HOUR;
  const refreshHours = context.config.jsearch.refresh_hours;
  if (ageHours >= refreshHours) return null;
  return `refreshed ${Math.floor(ageHours)}h ago; next refresh in ${Math.ceil(refreshHours - ageHours)}h`;
}

function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
```

`src/tools/searchFetch.ts`:

```ts
import { normalizeCompany } from "../jobs/company.js";
import type { Job } from "../jobs/job.js";
import { normalizeTitle } from "../jobs/normalize.js";
import { fetchJsearch, searchParams } from "../sources/jsearch.js";
import type { ToolContext } from "./context.js";
import { withoutDescription } from "./jobLog.js";
import { refreshBlocker, requestsThisMonth } from "./searchBudget.js";
import type { FetchOutcome, Search } from "./sources.js";

export async function refreshSearch(context: ToolContext, search: Search): Promise<FetchOutcome> {
  const blocker = refreshBlocker(context, search.name);
  if (blocker) return { seen: null, note: blocker };
  context.apiCalls.record("jsearch", search.name, context.now().toISOString());
  const jobs = await fetchJsearch({ search, settings: context.config.jsearch, apiKey: requireKey(context) }, context.http);
  const fresh = jobs.filter((job) => !hasBoardCopy(context, job));
  context.store.upsertAll(fresh, context.now().toISOString(), search.name);
  logSearchFetch(context, search, { fresh, skipped: jobs.length - fresh.length });
  return { seen: null, note: null };
}

function requireKey(context: ToolContext): string {
  if (!context.jsearchApiKey) throw new Error("JSEARCH_API_KEY is not set");
  return context.jsearchApiKey;
}

function hasBoardCopy(context: ToolContext, job: Job): boolean {
  const company = normalizeCompany(job.company);
  return context.store.boardCompaniesWithTitle(normalizeTitle(job.title)).some((name) => normalizeCompany(name) === company);
}

function logSearchFetch(context: ToolContext, search: Search, result: { fresh: Job[]; skipped: number }): void {
  context.jobLog.write({
    type: "search_fetch", source: search.name, query: search.query, params: searchParams(search, context.config.jsearch),
    requests_this_month: requestsThisMonth(context), job_count: result.fresh.length,
    skipped_duplicates: result.skipped, jobs: result.fresh.map(withoutDescription),
  });
}
```

`src/tools/fetchJobs.ts` (full file):

```ts
import { z } from "zod";
import { passesTitleFilter } from "../jobs/titleFilter.js";
import { fetchBoard } from "./boardFetch.js";
import type { ToolContext } from "./context.js";
import { summarizeJob } from "./jobSummary.js";
import { refreshSearch } from "./searchFetch.js";
import { findSource, type FetchOutcome, type Source } from "./sources.js";
import { defineTool, type Tool } from "./tool.js";

const PAGE_SIZE = 25;
const schema = z.object({ source: z.string().describe("Source name exactly as returned by list_sources") });

export function fetchJobsTool(context: ToolContext): Tool {
  return defineTool({
    name: "fetch_jobs",
    description: `Return up to ${PAGE_SIZE} unscored jobs from a source (a company board or a saved search) plus total_unscored. Score them with record_matches, then call again until total_unscored is 0.`,
    schema,
    run: ({ source }) => jobPage(context, findSource(context, source)),
  });
}

export function unscoredJobs(context: ToolContext, sourceName: string, outcome: FetchOutcome) {
  const { store, config } = context;
  const rows = outcome.seen === null ? store.unscoredForSource(sourceName) : store.unscoredSince(sourceName, outcome.seen);
  return rows.filter((row) => passesTitleFilter(row.title, config.title_filter));
}

async function jobPage(context: ToolContext, source: Source) {
  const outcome = await fetchOnce(context, source);
  const unscored = unscoredJobs(context, source.name, outcome);
  const jobs = unscored.slice(0, PAGE_SIZE).map((row) => summarizeJob(context, row));
  const page = { source: source.name, total_unscored: unscored.length, jobs };
  return source.kind === "search" ? { ...page, ...refreshFields(outcome) } : page;
}

function refreshFields(outcome: FetchOutcome) {
  return outcome.note === null ? { refreshed: true } : { refreshed: false, refresh_note: outcome.note };
}

function fetchOnce(context: ToolContext, source: Source): Promise<FetchOutcome> {
  const cached = context.run.fetches.get(source.name);
  if (cached) return cached;
  const pending = source.kind === "board" ? fetchBoard(context, source.company) : refreshSearch(context, source.search);
  context.run.fetches.set(source.name, pending);
  pending.then(() => context.run.failedFetches.delete(source.name), () => onFetchFailure(context, source));
  return pending;
}

function onFetchFailure(context: ToolContext, source: Source): void {
  context.run.fetches.delete(source.name);
  context.run.failedFetches.add(source.name);
}
```

`src/tools/listSources.ts`, two changes:

```ts
function describeSource(source: Source) {
  if (source.kind === "board") return { name: source.name, kind: source.kind, ats: source.company.ats };
  return { name: source.name, kind: source.kind };
}
```

and in `fetchedStatus`, take `cached: Promise<FetchOutcome>` (import `FetchOutcome` from `./sources.js`) and compute `total_unscored: unscoredJobs(context, source.name, await cached).length`:

```ts
async function fetchedStatus(context: ToolContext, source: Source, cached: Promise<FetchOutcome>) {
  try {
    const outcome = await cached;
    return { ...describeSource(source), fetched: true, total_unscored: unscoredJobs(context, source.name, outcome).length };
  } catch {
    return notFetched(context, source);
  }
}
```

`src/tools/context.ts` (full file):

```ts
import type { Trace } from "../agent/trace.js";
import type { FileConfig } from "../config/schema.js";
import type { ApiCallLog } from "../db/apiCalls.js";
import type { JobStore } from "../db/jobStore.js";
import type { JsonGetter } from "../http/client.js";
import type { FetchOutcome } from "./sources.js";

interface RunState {
  finished: boolean;
  summary: string | null;
  fetches: Map<string, Promise<FetchOutcome>>;
  failedFetches: Set<string>;
}

export interface ToolContext {
  config: FileConfig;
  run: RunState;
  store: JobStore;
  apiCalls: ApiCallLog;
  http: JsonGetter;
  now: () => Date;
  jobLog: Trace;
  jsearchApiKey: string | null;
}

export function newRunState(): RunState {
  return { finished: false, summary: null, fetches: new Map(), failedFetches: new Set() };
}
```

- [ ] **Step 8: Wire it into `run`**

In `src/app/run.ts`, import `ApiCallLog` from `../db/apiCalls.js`, then replace `buildContext` and `pruneOldJobs`:

```ts
function buildContext(config: AppConfig, seams: RunSeams, jobLog: Trace): ToolContext {
  const db = openDatabase(join(config.dataDir, "myjobbot.db"));
  return {
    config: config.file,
    run: newRunState(),
    store: new JobStore(db), apiCalls: new ApiCallLog(db),
    http: seams.http ?? new HttpClient({ config: config.file.http, clock: systemClock, fetchFn: globalThis.fetch, random: Math.random }),
    now: () => new Date(),
    jobLog,
    jsearchApiKey: config.env.JSEARCH_API_KEY ?? null,
  };
}

function pruneOldJobs(context: ToolContext): void {
  const cutoff = new Date(context.now().getTime() - context.config.job_retention_days * MS_PER_DAY).toISOString();
  context.store.pruneLastSeenBefore(cutoff);
  context.apiCalls.pruneBefore(cutoff);
}
```

- [ ] **Step 9: Verify and commit**

Run: `npm run check && tests/docker.sh`
Expected: all pass, habit-hooks clean, `all docker checks passed`.

```bash
git add -A src tests
git commit -m "Add JSearch saved searches with a code-enforced monthly budget"
```

---

### Task 6: Docs and live smoke

**Files:**
- Modify: `README.md`, `.env.example`, `docs/superpowers/specs/2026-10-03-myjobbot-design.md`, `docs/superpowers/specs/2026-10-04-jsearch-source-design.md`

- [ ] **Step 1: `.env.example`**

Append:

```
# Required only when config.json has "searches" (free key at openwebninja.com)
# JSEARCH_API_KEY=
```

- [ ] **Step 2: README**

- **Intro:** change the first sentence's source list to `company job boards (Greenhouse, Lever, Ashby) and saved JSearch searches (Google for Jobs: LinkedIn, Indeed and more)`.
- **Tool names:** replace every `list_companies` with `list_sources`. Replace `fetch_jobs({"company":"Palantir"})` with `fetch_jobs({"source":"Palantir"})`, `run({company: "Palantir"})` with `run({source: "Palantir"})`, and `{company, total_unscored: 34` with `{source, total_unscored: 34`.
- **Five-tools table:**
  - the `list_sources` row: `Each company board and saved search, with this run's progress: \`fetched\`, \`total_unscored\`, \`fetch_failed\``
  - the `fetch_jobs` row: `The first call per source per run downloads the board, or calls JSearch if the search is due. Every call returns **at most 25** unscored jobs that pass the title filter, plus \`total_unscored\`; search pages also say whether they were refreshed`
- **Configuration knobs table:**
  - change the `companies` row's default to `\`[]\`` and its meaning to `\`{name, ats, slug}\` per company board (at least one company or search)`
  - add four rows after it:

```markdown
| `searches` | `[]` | Saved JSearch searches: `{name, query, remote_only, country}`. Needs `JSEARCH_API_KEY` |
| `jsearch.monthly_request_cap` | 190 | JSearch requests allowed per calendar month (free tier is 200) |
| `jsearch.refresh_hours` | 24 | Each search calls JSearch at most once per this many hours |
| `jsearch.date_posted` | `3days` | Only postings this recent: `today`, `3days`, `7days`, `30days` |
```

- **New section** after "Configuration knobs":

```markdown
### Saved searches (JSearch)

JSearch searches Google for Jobs, which includes LinkedIn, Indeed, Glassdoor and company sites,
without scraping LinkedIn. Results are stored and scored like board jobs. A result is skipped when
the same employer and title already came from a company board you list. Budget: every request
is recorded in the `api_calls` table; a search refreshes at most once per `refresh_hours`, and
never once the month's count reaches `monthly_request_cap`. When a search isn't due,
`fetch_jobs` serves the stored jobs and says why. Each request writes a `search_fetch` line to
the run's jobs log.
```

- [ ] **Step 3: Specs**

- **Parent spec, Tools table:** replace the `list_companies` row with `| \`list_sources\` | — | boards and saved searches with run progress | See the JSearch spec |`, and in the `fetch_jobs` row change the argument `company` to `source`.
- **JSearch spec:** change `**Status:** Approved design, pending implementation plan` to `**Status:** Implemented`.

- [ ] **Step 4: Live smoke (needs a key)**

Check for a key without printing it:

```bash
grep -q '^JSEARCH_API_KEY=.\+' .env && echo "key present" || echo "no key"
```

- **If there is no key:** stop here and report "live JSearch smoke not run: no JSEARCH_API_KEY". Don't create an account or key.
- **If there is a key:**
  - add `"searches": [{ "name": "Senior backend remote US", "query": "senior backend engineer", "remote_only": true }]` to `data/config.json`
  - run `npm start -- run`
  - check the newest `log/*.jobs.jsonl` for a `search_fetch` line with `job_count` > 0
  - query the DB: `SELECT source, publisher, COUNT(*) FROM jobs WHERE ats='jsearch' GROUP BY 1, 2`
  - if the response failed zod validation, report the error and the top-level keys of the real response. Don't loosen the schema blindly.

- [ ] **Step 5: Verify and commit**

Run: `npm run check && tests/docker.sh`

```bash
git add README.md .env.example docs/superpowers/specs
git commit -m "Document saved searches and the JSearch budget"
```
