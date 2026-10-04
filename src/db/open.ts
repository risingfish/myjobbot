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

const ADDED_COLUMNS = ["source TEXT", "publisher TEXT"];
const AFTER_COLUMNS = `
UPDATE jobs SET source = company WHERE source IS NULL;
CREATE INDEX IF NOT EXISTS jobs_by_source ON jobs (source, scored_at);
`;
const SETTINGS = "PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;";
const BACKFILL_VERDICTS = `
INSERT INTO verdicts (ats, job_id, run_id, scored_at, score, reasons, gaps)
SELECT ats, job_id, NULL, scored_at, score, COALESCE(reasons, '[]'), COALESCE(gaps, '[]')
FROM jobs WHERE scored_at IS NOT NULL AND score IS NOT NULL`;

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(SETTINGS);
  db.exec(SCHEMA);
  addMissingColumns(db);
  db.exec(AFTER_COLUMNS);
  backfillVerdicts(db);
  return db;
}

function backfillVerdicts(db: DatabaseSync): void {
  const existing = Number(db.prepare("SELECT COUNT(*) AS count FROM verdicts").get()?.count);
  if (existing === 0) db.exec(BACKFILL_VERDICTS);
}

function addMissingColumns(db: DatabaseSync): void {
  const existing = new Set(db.prepare("PRAGMA table_info(jobs)").all().map((column) => String(column.name)));
  for (const definition of ADDED_COLUMNS) {
    const [name = ""] = definition.split(" ");
    if (!existing.has(name)) db.exec(`ALTER TABLE jobs ADD COLUMN ${definition}`);
  }
}
