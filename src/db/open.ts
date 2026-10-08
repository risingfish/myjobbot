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
CREATE TABLE IF NOT EXISTS api_calls (api TEXT NOT NULL, source TEXT NOT NULL, called_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS api_calls_by_api_time ON api_calls (api, called_at);
CREATE TABLE IF NOT EXISTS verdicts (
  ats TEXT NOT NULL, job_id TEXT NOT NULL, run_id TEXT, scored_at TEXT NOT NULL,
  score INTEGER NOT NULL, reasons TEXT NOT NULL, gaps TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS verdicts_by_time ON verdicts (scored_at);
`;

const SCORE_PARTS = ["base_score INTEGER", "bonus_score INTEGER"];
const ADDED_COLUMNS: Record<string, string[]> = {
  jobs: ["source TEXT", "publisher TEXT", "requirements TEXT", "skills TEXT", "preferred_skills TEXT", "hidden INTEGER NOT NULL DEFAULT 0", ...SCORE_PARTS],
  verdicts: SCORE_PARTS,
};
const AFTER_COLUMNS = `
UPDATE jobs SET source = company WHERE source IS NULL;
CREATE INDEX IF NOT EXISTS jobs_by_source ON jobs (source, scored_at);
`;
const SETTINGS = "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;";
const BACKFILL_VERDICTS = `
INSERT INTO verdicts (ats, job_id, run_id, scored_at, score, reasons, gaps)
SELECT ats, job_id, NULL, scored_at, score, COALESCE(reasons, '[]'), COALESCE(gaps, '[]')
FROM jobs WHERE scored_at IS NOT NULL AND score IS NOT NULL`;

/** Opens the SQLite database at a path, creating or migrating its schema as needed. */
export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(SETTINGS);
  db.exec(SCHEMA);
  addMissingColumns(db);
  db.exec(AFTER_COLUMNS);
  backfillVerdicts(db);
  return db;
}

/** Seeds the verdicts table from already-scored jobs the first time it's empty, so history isn't lost on upgrade. */
function backfillVerdicts(db: DatabaseSync): void {
  const existing = Number(db.prepare("SELECT COUNT(*) AS count FROM verdicts").get()?.count);
  if (existing === 0) db.exec(BACKFILL_VERDICTS);
}

/** Adds any columns later schema versions introduced to every table listed in ADDED_COLUMNS. */
function addMissingColumns(db: DatabaseSync): void {
  for (const [table, definitions] of Object.entries(ADDED_COLUMNS)) addColumns(db, table, definitions);
}

/** Adds each listed column definition to a table unless a column of that name already exists. */
function addColumns(db: DatabaseSync, table: string, definitions: string[]): void {
  const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => String(column.name)));
  for (const definition of definitions) {
    const [name = ""] = definition.split(" ");
    if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}
