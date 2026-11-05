# Implementation Plan: Resume profile

**Branch**: `023-resume-profile` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `docs/specs/023-resume-profile/spec.md`

## Summary

The owner's resume moves from a hand-placed file into the database: uploaded on the Settings page
(Markdown, text, PDF or Word, read to text only), shown back as text, and used by runs and
re-scores in place of `data/resume.md`, which stays as the fallback. The owner can have the model
extract a profile from it, a preferences-style summary and skills in three groups (engineering,
people, project), through a short agent session whose only view of the resume is a wrapped
`get_resume` tool and whose answer is a schema-checked `record_profile` call. The profile is
editable on the Settings page, and its summary can be copied into Preferences. A new search
setting, `resume_view`, chooses what the scoring model reads about the owner (resume, resume and
profile, profile only), built by one `ownerMessage` for runs, re-scores and eval runs, always
inside data markers; the eval harness can run each choice, a series included.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node (tsx); Next.js 16.4 and React 19 for the Settings page

**Primary Dependencies**: Kysely 0.29, zod 4, the OpenAI client and agent loop; **new, approved by the owner
(2026-11-05)**: unpdf 2.1.0 (PDF text) and mammoth 1.13.0 (Word text), exact pins (research R3)

**Storage**: MariaDB, migration `017_resume` (`resumes`, `resume_profiles`); the `resume_view`
search setting in `user_settings`; eval profile and run files gain optional fields

**Testing**: vitest `node` (unit: memory stores, scripted chat), `integration` (the ResumeStore
contract and the migration on `myjobbot_test`), `dom` (the Resume section); PDF and Word readers
tested on small fixture files kept as base64 constants in `tests/helpers/resumeFixtures.ts`

**Target Platform / Project Type**: the owner's server and the cluster; web app plus agent in the
single project

**Performance Goals**: upload and show under a minute (SC-001); extraction under 2 minutes for a
typical resume (SC-003), capped at 3

**Constraints**: the resume is personal data: database only, never logs or git (FR-012); file and
model text reach the model only inside data markers (feature 009); shown as text, never markup
(feature 012's rule); 5 MB upload (Next's server-action body limit raised to 6 MB, the size also
checked in the browser), 100,000 characters (`.length`) of text; the extraction's model-response
log keeps only usage; `data/resume.md` becomes optional

**Scale/Scope**: one owner, one resume, one profile of up to 100 skills

## Constitution Check

Checked against constitution **v2.5.0**.

| Principle | Check |
|---|---|
| I. Habit-hooks clean | Every sitting ends green; new modules wired in the sitting that creates them; files ≤ 200 lines; `store.ts` grows by one store, kept under 200 by a separate `resumeStore.ts`; the new tables' types go in `src/db/schema/resume.ts` (after the split in #110), `schema.ts` gaining two lines; ≤ 3 parameters, so `ownerMessage(config, markers, closing)` reads the profile from `config` |
| II. Test-first, mix | Pure functions for limits, readers' outcomes, profile validation, dedupe, staleness and `ownerMessage`; the store behind a contract run on memory and MariaDB. Planned +39 unit, +4 integration, +3 UI (ledger in tasks.md) |
| III. Purpose comments | One-line doc comment per function |
| IV. Dependencies | PDF and Word libraries presented with trade-offs and a recommendation (research R3) and **approved by the owner (unpdf 2.1.0, mammoth 1.13.0)**; exact pins, lockfile |
| V. docs/specs | This directory |
| Workflow (2.5.0) | S1 adds a migration and S4 changes the run path (`src/agent/prompt.ts`, `src/rescore/prompt.ts`): stack stopped. S2 and S3 are UI work (Settings page and its server actions, no migration, no run-path change): the stack may run; S2 adds dependencies, so the images are rebuilt right after the install, before any code imports them |

Gate: passes.

## Project Structure

### Documentation (this feature)

```text
docs/specs/023-resume-profile/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/settings-resume.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/db/migrations/017_resume.ts       resumes, resume_profiles (S1)
src/db/schema/resume.ts               their table types (S1)
src/contentId.ts                      sha16, shared with src/evals/ids.ts (S1)
src/db/resumeStore.ts                 ResumeStore interface, Resume and Profile types (S1)
src/db/kysely/resumeStore.ts          Kysely store (S1)
src/config/load.ts                    resume.md optional, readResumeFile (S1)
src/app/runSettings.ts                the stored resume, else data/resume.md, else refused (S1)
src/resume/limits.ts                  file type, size and text checks (S1)
src/resume/read.ts                    text from md/txt (S1), pdf via unpdf and docx via mammoth (S2)
src/resumeProfile/extract.ts          the extraction session, get_resume and record_profile, usage-only response log (S3)
src/resumeProfile/profile.ts          the profile's schema, dedupe, staleness (S3)
src/agent/ownerMessage.ts             the first user message for every scoring path (S4)
src/agent/prompt.ts, src/rescore/prompt.ts   use ownerMessage (S4)
src/config/schema.ts, src/web/settingsSections.ts   resume_view (S4)
src/evals/…                            profile's resumeProfile, run --view, series +view (S4)
web/next.config.ts                    server-action body limit 6 MB (S1)
web/lib/uiState.ts                    SettingsState.resume (S1)
web/lib/resumeActions.ts              uploadResume (S1), extractResumeProfile, saveResumeProfile (S3)
web/lib/useProfileSave.ts             the profile editor's save (S3)
web/components/settings/PreferencesDraft.tsx   shared Preferences text for "Use summary" (S3)
web/components/settings/ResumeSection.tsx and parts   upload and text (S1), profile editor (S3)

tests/
├── helpers/resumeContract.ts (+ memory store), integration (S1)
├── resumeLimits, resumeRead (+ helpers/resumeFixtures.ts) (S1, S2), resumeProfile, resumeExtract (S3),
│   ownerMessage, evalView (S4)
└── client/resumeSection.test.tsx (S1, S3)
```

**Structure Decision**: a resume module (`src/resume/`) for reading files, a profile module
(`src/resumeProfile/`) for the model's work, both knowing nothing about Next.js; the Settings page
calls them through server actions; one `ownerMessage` used by every scoring path.

## Complexity Tracking

None.
