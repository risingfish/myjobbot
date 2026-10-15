import { mkdtempSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCHEMA = `
CREATE TABLE jobs (
  ats TEXT NOT NULL, job_id TEXT NOT NULL, company TEXT NOT NULL, title TEXT NOT NULL, normalized_title TEXT NOT NULL,
  location TEXT, department TEXT, team TEXT, workplace_type TEXT, is_remote INTEGER, compensation TEXT, url TEXT NOT NULL,
  posted_at TEXT, description TEXT, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, scored_at TEXT, score INTEGER,
  reasons TEXT, gaps TEXT, emailed_at TEXT, source TEXT, publisher TEXT, requirements TEXT, skills TEXT, preferred_skills TEXT,
  hidden INTEGER NOT NULL DEFAULT 0, base_score INTEGER, bonus_score INTEGER, PRIMARY KEY (ats, job_id));
CREATE TABLE verdicts (ats TEXT NOT NULL, job_id TEXT NOT NULL, run_id TEXT, scored_at TEXT NOT NULL,
  score INTEGER NOT NULL, reasons TEXT NOT NULL, gaps TEXT NOT NULL, base_score INTEGER, bonus_score INTEGER);
CREATE TABLE api_calls (api TEXT NOT NULL, source TEXT NOT NULL, called_at TEXT NOT NULL);`;

const JOB = `INSERT INTO jobs (ats, job_id, company, title, normalized_title, url, posted_at, description, first_seen, last_seen,
  scored_at, score, reasons, gaps, source, publisher, hidden, base_score, bonus_score, is_remote)
VALUES (?, ?, 'Acme', ?, lower(?), ?, '2026-09-30T00:00:00.000Z', 'Zürich C++ 🚀', '2026-10-01T00:00:00.000Z',
  '2026-10-02T00:00:00.000Z', '2026-10-02T01:00:00.000Z', 80, '["fits"]', '[]', 'Stripe', NULL, ?, 50, 30, 1)`;
const VERDICT = "INSERT INTO verdicts (ats, job_id, run_id, scored_at, score, reasons, gaps, base_score, bonus_score) VALUES ('greenhouse', ?, 'run-1', ?, 80, '[\"fits\"]', '[]', 50, 30)";

export interface FixtureOptions {
    jobs: number;
    longTitle?: boolean;
}

export function sqliteFixture({ jobs, longTitle = false }: FixtureOptions): string {
    const path = join(mkdtempSync(join(tmpdir(), "myjobbot-import-")), "myjobbot.db");
    const db = new DatabaseSync(path);
    db.exec(SCHEMA);
    for (let index = 0; index < jobs; index += 1) {
        const title = longTitle && index === 0 ? "t".repeat(600) : `Engineer ${index}`;
        db.prepare(JOB).run("greenhouse", `job-${index}`, title, title, `https://example.com/${index}`, index % 3 === 0 ? 1 : 0);
        db.prepare(VERDICT).run(`job-${index}`, `2026-10-02T01:00:${String(index % 60).padStart(2, "0")}.000Z`);
    }
    db.prepare("INSERT INTO api_calls VALUES ('jsearch', 'Search', '2026-10-01T00:00:00.000Z')").run();
    db.close();
    return path;
}
