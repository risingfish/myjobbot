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

test("openDatabase adds the publisher column and the api_calls table", () => {
  const db = openDatabase(preSourceDatabase());
  const columns = db.prepare("PRAGMA table_info(jobs)").all().map((column) => column.name);
  expect(columns).toContain("publisher");
  expect({ ...db.prepare("SELECT COUNT(*) AS count FROM api_calls").get() }).toEqual({ count: 0 });
});

test("openDatabase adds the requirements and skills columns", () => {
  const db = openDatabase(preSourceDatabase());
  const columns = db.prepare("PRAGMA table_info(jobs)").all().map((column) => column.name);
  expect(columns).toEqual(expect.arrayContaining(["requirements", "skills", "preferred_skills", "hidden"]));
  expect({ ...db.prepare("SELECT hidden FROM jobs WHERE job_id = 'old-1'").get() }).toEqual({ hidden: 0 });
});

test("openDatabase adds the base and bonus columns to jobs and verdicts", () => {
  const db = openDatabase(preSourceDatabase());
  for (const table of ["jobs", "verdicts"]) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
    expect(columns).toEqual(expect.arrayContaining(["base_score", "bonus_score"]));
  }
});
