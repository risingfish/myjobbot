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
