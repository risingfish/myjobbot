---

description: "Tasks for feature 023: resume profile"
---

# Tasks: Resume profile

**Input**: Design documents from `docs/specs/023-resume-profile/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/settings-resume.md, quickstart.md;
PR #110 (the `src/db/schema/` split) merged first

**Tests**: required by the constitution (Principle II); each test task names its kind and count.

**Organization**: one phase per user story, in sittings, one PR per sitting.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: US1 upload and read, US2 extract the profile, US3 summary into Preferences, US4 score against the profile

## Sittings

| Sitting | PR | Stack | Why |
|---|---|---|---|
| S1 storage, runs use it, text upload | 1 | stopped | migration `017_resume`; `web/next.config.ts` changes |
| S2 PDF and Word | 2 | may run, rebuilt in T013 | UI work; adds unpdf and mammoth, so the images are rebuilt right after the install, before any code imports them |
| S3 profile extraction and editor | 3 | may run | UI work (Settings page and its server actions) |
| S4 scoring setting, `ownerMessage`, eval view | 4 | stopped | changes the run path (`src/agent/prompt.ts`, `src/rescore/prompt.ts`) |
| S5 docs | 5 | may run | docs and the Helm chart's notes only |

- Each sitting's first task creates `.specify/sitting-in-progress` naming it; its last task runs
  `npm run check` and `npm run check:db` until green, deletes the marker, and commits and opens the
  PR only when the owner asks. While the stack runs, every turn ends clean (each test lands in the
  same turn as the code it covers).
- Every store method and export is reached from production in the sitting that creates it
  (knip's production pass): the resume store's writer arrives with the upload (S1), the profile's
  with the extraction (S3).

---

## Phase 1: Setup

- [X] T001 Stop the Docker stack, cut `023-resume-profile` from main after #110, create `.specify/sitting-in-progress` naming S1, and re-take the baseline counts (`npm run check` and `npm run check:db`; 2026-11-05 on main: unit 922, integration 70, UI 64), updating the ledger's baseline and "Planned after" rows if they differ

---

## Phase 2: User Story 1 - Upload the resume and read it in the app (P1) 🎯 MVP

**Goal**: FR-001–FR-004, FR-012. **Independent Test**: quickstart §1–§2.

### Sitting S1: storage, runs use it, text upload (PR 1)

#### Tests (S1)

- [X] T002 [P] [US1] Add `tests/helpers/resumeContract.ts` (registered in `tests/storeContract.test.ts` and `tests/integration/storeContract.test.ts`) with 2 cases (2 unit on memory, 2 integration on MariaDB): on an empty database (no `users` row) `currentResume(OWNER_ID)` is null until `saveResume(OWNER_ID, { text, fileName, fileType, uploadedAt })` stores one, which reads back with its `contentId` (`sha16(text)`); a second save replaces it, the `contentId` changing with the text; a resume of 100,000 characters (`.length`, with emoji) round-trips exactly
- [X] T003 [P] [US1] Write an integration test (1) in `tests/integration/resumeMigration.test.ts`: step `017_resume` creates `resumes` and `resume_profiles` with the columns of data-model.md, both `utf8mb4_bin`, each with a foreign key to `users`; add `017_resume` to the migration-name lists in `tests/integration/migrate.test.ts` (4 places), `companyMigrations.test.ts` (4), `lookupIndexes.test.ts` and `boostMigration.test.ts`; add both tables to `TABLES` in `tests/helpers/testDb.ts` before `"user_settings"` (`"resume_profiles", "resumes"`), and to the collation list in `tests/integration/migrate.test.ts`
- [X] T004 [P] [US1] Write unit tests (3) in `tests/resumeLimits.test.ts` for `src/resume/limits.ts`: `fileTypeOf(name)` gives `md`, `txt`, `pdf` or `docx` by extension, ignoring case, and null for anything else (`.png`, `.doc`, no extension; the browser's MIME type is not used, as `.md` often arrives as `""` or `application/octet-stream`); a file over 5 MB (5 × 1024 × 1024 bytes) is refused with `That file is over 5 MB`; `checkedText(text)` trims, refuses empty (`No text could be read from that file`) and over 100,000 characters by `.length` (`The resume is over 100,000 characters`)
- [X] T005 [P] [US1] Write unit tests (2) in `tests/resumeUpload.test.ts` for `uploadFor(stores, file, now)` in `web/lib/resumeRows.ts` and `readResume(bytes, type)` in `src/resume/read.ts`: a `.md` and a `.txt` upload are read as UTF-8 and stored, answering `{ ok: true, resume }`; a refused file answers `{ ok: false, error }` with its fixed message and stores nothing
- [X] T006 [P] [US1] Write unit tests (2) in `tests/runSettings.test.ts`: `settingsForRun` gives the stored resume when there is one, else `data/resume.md`'s text, without changing anything else; with neither it refuses with `No resume: upload one on the Settings page` (and the existing `runSettings`, `config` and `configFiles` tests are updated for `LoadedConfig.resume` being `string | null`, 0 new)
- [X] T007 [P] [US1] Write a UI test (1) in `tests/client/resumeSection.test.tsx`: the Resume section shows "Using data/resume.md" and the file's text before an upload, or "No resume yet" with neither; after a successful upload the file name, upload time and text appear in a `pre` (markup in the text shown as literal characters); a refused upload, and a file over 5 MB caught in the browser before sending, show their messages and keep the earlier text

#### Implementation (S1)

- [X] T008 [US1] Add `src/db/migrations/017_resume.ts` with the schema builder (`resumes`: `user_id` int primary key, foreign key to `users.id`, `text` mediumtext, `file_name` varchar(255), `file_type` varchar(8), `uploaded_at` varchar(32), `content_id` char(16); `resume_profiles`: `user_id` int primary key, foreign key to `users.id`, `resume_id` char(16), `summary` text, `skills` text, `extracted_at` varchar(32), `edited_at` varchar(32) null; both `utf8mb4_bin`), list it in `src/db/migrations/index.ts`, put both tables' types in `src/db/schema/resume.ts` and their two entries in `src/db/schema.ts`'s `Database`
- [X] T009 [US1] Create `src/db/resumeStore.ts` (type `Resume`, the `ResumeStore` interface with `currentResume(userId)` and `saveResume(userId, resume)`), `src/db/kysely/resumeStore.ts` (one row per user, upsert with `onDuplicateKeyUpdate`; `saveResume` first ensures the owner's `users` row, as `SearchSettingsStore` does), the memory store in `tests/helpers/`, and `resume` in `Stores` (`src/db/store.ts`, `src/db/kysely/stores.ts`, `tests/helpers/memoryStore.ts`); move `hashed()` out of `src/evals/ids.ts` into an exported `sha16(text)` in `src/contentId.ts`, used by both
- [X] T010 [US1] Create `src/resume/limits.ts` and `src/resume/read.ts` (Markdown and text only in this sitting; PDF and Word answer `That file type isn't supported…` until S2); make `LoadedConfig.resume` `string | null` (`loadConfig` reads `resume.md` only when it exists, through an exported `readResumeFile(dataDir)` in `src/config/load.ts`); change `settingsForRun` (`src/app/runSettings.ts`) to take the stores' `searchSettings` and `resume`, using the stored resume, else the file, else refusing with T006's message; update its four callers (`src/app/run.ts`, `src/rescore/open.ts`, `src/evals/command.ts` ×2)
- [X] T011 [US1] Create `web/lib/resumeRows.ts` (`uploadFor`), the server action `uploadResume(formData)` in `web/lib/resumeActions.ts`, and `web/components/settings/ResumeSection.tsx` (file input, Upload button, the size checked in the browser before sending, the stored or fallback resume as text or "No resume yet"); set `experimental.serverActions.bodySizeLimit` to `"6mb"` in `web/next.config.ts` (Next's default is 1 MB); add `resume: { kind: "stored", … } | { kind: "file", text } | { kind: "none" }` to `SettingsState` in `getSettingsState` (`web/lib/uiState.ts`); add the section to the Settings page after Preferences; update `tests/client/settings.test.tsx` (the title list gains "Resume" after "Preferences", the mocked state a resume, and `vi.mock("../../web/lib/resumeActions.js")`, 0 new); the resume text is never logged
- [X] T012 [US1] Run `npm run check` and `npm run check:db` until green; quickstart §1–§2; delete the marker; when the owner asks, commit S1 and open PR 1

**Checkpoint**: PR 1. The resume can be uploaded, read back, and is used by runs and re-scores; `data/resume.md` is optional.

---

## Phase 3: User Story 1 (continued) - PDF and Word

**Goal**: FR-002's PDF and Word. **Independent Test**: quickstart §3.

### Sitting S2: PDF and Word (PR 2, stack may run)

- [X] T013 [US1] Create `.specify/sitting-in-progress` naming S2; install **unpdf 2.1.0** and **mammoth 1.13.0** with exact pins through the lockfile (`npm install --save-exact`, keeping the lockfile's optional platform entries); check no run is in flight, then rebuild the images (`docker compose up -d --build`) before any code imports them, so the live web service has them
- [X] T014 [US1] Add `tests/helpers/resumeFixtures.ts` holding base64 constants (in memory, so the tests stay unit): a two-page text PDF, a `.docx`, an image-only PDF and a truncated PDF, each under 20 KB, made once by hand (LibreOffice export of a made-up resume; the truncated one cut in half), how they were made noted in the file's doc comment; write unit tests (4) in `tests/resumeRead.test.ts`: the PDF's and the Word file's text come out with the expected words in order; the image-only PDF gives `No text could be read from that file`; the truncated file gives `That file couldn't be read`, with no library message passed on
- [X] T015 [US1] In `src/resume/read.ts`, read PDF with unpdf's `extractText(…, { mergePages: true })` (checking the installed API first) and `.docx` with mammoth's `extractRawText({ buffer })`, in memory only; any library error becomes `That file couldn't be read`; same turn as T014's tests
- [X] T016 [US1] Run `npm run check` and `npm run check:db` until green; quickstart §3; delete the marker; when the owner asks, commit S2 and open PR 2

---

## Phase 4: User Story 2 + 3 - Extract the profile, and use its summary (P1, P2)

**Goal**: FR-005–FR-009, FR-012. **Independent Test**: quickstart §4.

### Sitting S3: profile extraction and editor (PR 3, stack may run)

#### Tests (S3)

- [X] T017 [P] [US2] Create `.specify/sitting-in-progress` naming S3; write unit tests (4) in `tests/resumeProfile.test.ts` for `src/resumeProfile/profile.ts`: the extracted-profile schema refuses a group other than the three, a skill name over 80 characters, 0 or more than 100 skills, or a summary over 4,000 characters; `dedupedSkills` keeps each name once, ignoring case and surrounding spaces, in its first group; `isStale(profile, resume)` is true when the resume's `contentId` differs; `movedSkill` moves one skill to another group
- [X] T018 [P] [US2] Write unit tests (4) in `tests/resumeExtract.test.ts` for `extractProfile(resume, deps)` in `src/resumeProfile/extract.ts` with `usageChat`: a model that calls `get_resume` then `record_profile` gives the deduped profile, the resume having reached it only inside the data markers (from a random id); a look-alike marker in the resume is removed and traced (no job is flagged); a model that never records, or records something the schema refuses, gives a fixed failure and nothing to store; the response log holds only usage, never the profile's text; `get_resume` is declared `outsideText: true` (also added to `tests/toolDeclarations.test.ts`, 0 new)
- [X] T019 [P] [US2] Add a case to `tests/helpers/resumeContract.ts` (1 unit, 1 integration): `profile(userId)` is null until `saveProfile(userId, profile)` stores one, which reads back with its skills in order; `saveProfile` with `edited: true` sets `edited_at`; a profile survives a new resume upload, unchanged
- [X] T020 [P] [US2] Write unit tests (3) in `tests/resumeUpload.test.ts` for `extractFor` and `editFor` in `web/lib/resumeRows.ts`: extracting with no resume is refused; an edit (summary, a moved, added or removed skill, removing every skill allowed) is checked by the edit schema (0..100 skills) and saved marked edited; adding a skill whose name is already there, ignoring case, is refused with `That skill is already listed`
- [X] T021 [US2] [US3] Write UI tests (2) in `tests/client/resumeSection.test.tsx`, mounting the Resume and Preferences sections inside `PreferencesDraft`: the profile shows the summary and three tag clouds; moving a skill saves through `useProfileSave` (`SaveFailedNote` on failure); a stale profile says "From an earlier resume"; "Extract again" opens a Pico `<dialog>` to confirm when the profile was edited; "Use summary in Preferences" puts the summary in the Preferences box, marked edited so its Save bar shows, without calling any save action

#### Implementation (S3)

- [X] T022 [US2] Create `src/resumeProfile/profile.ts` (the extracted schema with 1..100 skills, the edit schema with 0..100, `dedupedSkills`, `isStale`, `movedSkill`) and add `profile(userId)` and `saveProfile(userId, profile)` to the resume store (Kysely and memory)
- [X] T023 [US2] Create `src/resumeProfile/extract.ts`: a short `runAgent` session (4 steps, 3 minutes) with its own system prompt holding the data sentence, tools `get_resume` (`outsideText: true`, returns `{ text }`) and `record_profile` (the schema), markers from `randomUUID()`, `onLookalike` tracing only; the model from `createChat` given a response log that keeps only each response's usage (`usageOnlyLog`, in `src/resumeProfile/`); its trace written to `data/runs/` like a run's (the model's conversation), never to `rescore_runs` or `rescore_steps`
- [X] T024 [US2] Add `extractResumeProfile()` and `saveResumeProfile(edit)` to `web/lib/resumeActions.ts` (with `extractFor`, `editFor` in `web/lib/resumeRows.ts`); add `web/lib/useProfileSave.ts` (a `useActionState` over `saveResumeProfile`, showing `SaveStatus` and `SaveFailedNote`); add the profile editor to `ResumeSection` (summary text area saved on blur, three Pico tag clouds with add, remove and move saved on each change; Extract, and Extract again with its dialog; the stale note)
- [X] T025 [US3] Add `web/components/settings/PreferencesDraft.tsx`, a client provider holding the Preferences text and its edited flag, wrapping the Preferences and Resume sections on the Settings page; `PreferencesSection` reads and writes it instead of its own `useState`; "Use summary in Preferences" in the Resume section sets the text and the edited flag and scrolls to the box, without saving; re-check `tests/client/settings.test.tsx`'s `main > div > h4` selector
- [X] T026 Run `npm run check` and `npm run check:db` until green; quickstart §4 with the real model; delete the marker; when the owner asks, commit S3 and open PR 3

---

## Phase 5: User Story 4 - Score jobs against the profile (P2)

**Goal**: FR-010, FR-011. **Independent Test**: quickstart §5.

### Sitting S4: scoring setting, ownerMessage, eval view (PR 4, stack stopped)

- [X] T027 [US4] Stop the stack and cut the S4 branch from main; before any change on it, run `npm start -- eval run --tag smoke --repeats 3` over the owner's smoke cases (or the cases they name, if none are tagged) and note the run id: the baseline for the wrapping (research R4); then create `.specify/sitting-in-progress` naming S4

#### Tests (S4)

- [X] T028 [P] [US4] Write unit tests (6) in `tests/ownerMessage.test.ts` for `ownerMessage(config, markers, closing)` in `src/agent/ownerMessage.ts`, which reads `config.resume`, `config.profile` and `config.settings.resume_view`: `resume` puts the resume inside the markers then the closing line; `resume_and_profile` adds "What to look for in a job posting, from my resume:" and the three skill lines inside the same markers; `profile` holds the line "My resume isn't included; judge fit with it from this profile." then the summary and the skill lines; with no profile every choice reads as `resume`; a stale profile is still used; a look-alike marker in the resume or profile is removed with `scrubText` and traced
- [X] T029 [P] [US4] Write unit tests (2): `resume_view` in `settingsSchema` defaults to `resume` and a bad stored value falls back with a notice (`tests/` settings tests); the Scoring section's select saves it (`tests/settingsSections.test.ts` or the scoring UI test, 0 new UI)
- [X] T030 [P] [US4] Write unit tests (4) for the eval harness: capture freezes the stored profile into the eval profile as `resumeProfile`, and the profile's id includes it; `eval run --view resume_and_profile` sends the matching first user message and records `view`; a `profile` or `resume_and_profile` view on a case captured without a resume profile is refused before any model call (both in one case); a series test `both=code+resume_and_profile@<model>` runs with that view and that model, a model name holding `:` kept whole
- [X] T031 [US4] In `tests/prompt.test.ts`, replace "the resume and preferences stay outside any marker" with its reverse (the resume sits inside this run's markers; the preferences stay outside), and add 2 cases: a run's and a re-score's first user message under `resume_and_profile` hold the profile's skill lines (`initialMessages`, `rescoreMessages`); the system-prompt snapshot (`tests/__snapshots__/prompt.test.ts.snap`) stays unchanged

#### Implementation (S4)

- [X] T032 [US4] Create `src/agent/ownerMessage.ts`; use it in `src/agent/prompt.ts` (runs) and `src/rescore/prompt.ts` (re-scores); `AppConfig` gains `profile: { summary, skills } | null` (read with the resume in `settingsForRun`; `appConfigFrom` in `src/config/parse.ts`); add `resume_view` to `settingsSchema`, the search settings and the Scoring section (`src/web/settingsSections.ts`, `web/components/settings/ScoringSection.tsx`)
- [X] T033 [US4] In `src/evals/`: the profile file's optional `resumeProfile` (format, capture); `configFor` (`src/evals/session.ts`) swaps in the case's `resumeProfile` and the run's view; `eval run --view` (default `resume`; the run's optional `view`, the refusal, the report header); a series test's optional `+view` after the variant (`<label>=<variant|code>[+view][@model]`, `TEST` in `src/evals/series.ts` and `SERIES_USAGE`)
- [X] T034 [US4] Run `npm run check` and `npm run check:db` until green; quickstart §5; run T027's cases again on the branch and compare (`eval report <new> --against <baseline>`), noting the effect of the wrapping in the PR; delete the marker; when the owner asks, commit S4 and open PR 4

---

## Phase 6: Polish

### Sitting S5: docs (PR 5, stack may run)

- [X] T035 [P] Create `.specify/sitting-in-progress` naming S5; README: the Resume section of the Settings page (upload, the file types and limits, the profile, the summary into Preferences, "What the model reads about you"), `data/resume.md` now optional (the fallback until an upload), and the eval `--view` and series `+view`; the Helm chart: `values.yaml`'s comment and `templates/NOTES.txt` say `resume.md` is optional once a resume is uploaded
- [X] T036 [P] CLAUDE.md: a resume paragraph (`resumes` and `resume_profiles` written only through `ResumeStore`; PDF and Word read to text only through unpdf 2.1.0 and mammoth 1.13.0, pinned; the resume and profile reach the model only inside data markers, scrubbed, and are shown as text only; the extraction's response log keeps only usage; `ownerMessage` builds the first user message for every scoring path; `resume_view`; migration `017_resume`)
- [ ] T037 Fill the ledger's last row; run `npm run check` and `npm run check:db`; delete the marker; when the owner asks, commit S5 and open PR 5; restart the stack once the feature has merged

---

## Dependencies & Execution Order

- #110 → S1 → S2 → S3 → S4 → S5, each PR merged before the next (small PRs).
- S2 needs S1's reader; S3 needs S1's store and tables; S4 needs S3's profile.
- Within a sitting, its tests come first and fail first (S4's baseline eval run, T027, comes before them).
- First production callers: the store, limits, text reader, `sha16`, `readResumeFile`,
  `settingsForRun` change, upload action and section (S1); the PDF and Word readers (S2); the
  profile module, extraction, `usageOnlyLog`, profile store methods, actions, `useProfileSave`,
  `PreferencesDraft` and editor (S3); `ownerMessage`, `resume_view` and the eval view (S4).

## Parallel Opportunities

- S1: T002–T007 together.
- S3: T017–T020 together.
- S4: T028–T030 together.
- S5: T035 and T036 together.

## Implementation Strategy

- **MVP**: S1 (upload and use the resume from the app); S2 widens the file types; S3 adds the
  profile; S4 lets it change scoring, measured first.

## Test ledger (constitution Principle II, target 95 / 4 / 1)

| | Unit | Integration | UI |
|---|---|---|---|
| Baseline (2026-11-05 on main after #111, T001) | 922 (87.23%) | 71 (6.72%) | 64 (6.05%) |
| Planned new | 39 (S1 9: T002 2, T004 3, T005 2, T006 2; S2 4: T014; S3 12: T017 4, T018 4, T019 1, T020 3; S4 14: T028 6, T029 2, T030 4, T031 2) | 4 (T002 2, T003 1, T019 1) | 3 (T007 1, T021 2) |
| Planned removed | 0 (T031 rewrites one test) | 0 | 0 |
| Planned after | 961 (87.13%) | 75 (6.80%) | 67 (6.07%) |
| After S1–S5 (T037, 2026-11-05) | 961 (87.13%) | 75 (6.80%) | 67 (6.07%) |

The integration share rises slightly because the new tables need their contract on MariaDB (the
constitution's database rule); the unit share stays near 87%.

## Notes

- Never print `.env`, the resume or the profile; integration tests use `myjobbot_test` only.
