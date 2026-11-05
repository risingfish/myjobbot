# Research: Resume profile

## R1. Where the resume and profile are stored

- **Decision**: two new tables (migration `017_resume`), written only through a new
  `ResumeStore` (`src/db/resumeStore.ts`, Kysely and memory, with a store contract):
  - `resumes`: one row per user (`user_id` = `OWNER_ID`): the text, the original file name and
    type, when it was uploaded, and a content id (`sha16`: first 16 hex of SHA-256 of the text, moved from `src/evals/ids.ts` to
    `src/contentId.ts` so both share it).
  - `resume_profiles`: one row per user: the summary, the skills as JSON, the content id of the
    resume it came from, when it was extracted and, if edited, when.
  - Both have a foreign key to `users`; `saveResume` and `saveProfile` first ensure the owner's
    row, as `SearchSettingsStore` does. Store methods take `userId`, like the other stores.
- **Rationale**: the resume follows the app into the cluster with the rest of its data; one row
  per user keeps "a new upload replaces the current one" trivial; the content id tells a profile
  from an older resume (FR-008) without keeping old resumes.
- **Alternatives**: a file in the data folder (doesn't follow the app across pods); a JSON field in
  `user_settings` (the resume is large and not a search setting).

## R2. Which resume a run uses (FR-004)

- **Decision**: `loadConfig` reads `data/resume.md` only when it exists (`LoadedConfig.resume` is
  `string | null`; today it throws when the file is missing, so an upload couldn't replace it).
  `settingsForRun` (and the web's settings resolution) uses the stored resume, else the file, else
  refuses with `No resume: upload one on the Settings page`. `AppConfig.resume` keeps its meaning
  (the text in use, a string), so runs, re-scores, eval capture and everything downstream need no
  change to get it. The Helm chart's notes say the file is optional once a resume is uploaded.
- **Rationale**: one place decides; the fallback keeps today's behaviour until an upload.

## R3. Reading the uploaded file (FR-002): libraries for the owner to approve

Markdown and plain text are read as UTF-8 with no library. PDF and Word need one each
(constitution IV: present the options, the owner approves):

| Format | Candidate | Version | Notes |
|---|---|---|---|
| PDF | **unpdf** | 2.1.0 (Oct 2026) | Wraps Mozilla's pdf.js for Node and serverless: `extractText(pdf, { mergePages: true })`; no native code, no worker setup; ESM. **Recommended.** |
| PDF | pdfjs-dist | 6.5.438 | The canonical pdf.js. In Node it needs its legacy build and worker setup by hand; larger surface to wire correctly. |
| PDF | pdf-parse | 2.4.5 | Old API rewritten in 2025; historically unmaintained and known for a debug-mode test-file bug. Not recommended. |
| Word | **mammoth** | 1.13.0 (Sep 2026) | Reads `.docx` only; `extractRawText({ buffer })` gives the text and nothing else. Widely used. **Recommended.** |
| Both | officeparser | 8.5.0 | One library for PDF, Word, PowerPoint, Excel and OpenDocument; more formats means more untrusted-file parsing code than needed. |

- **Decision (approved by the owner, 2026-11-05)**: **unpdf 2.1.0** and **mammoth 1.13.0**, pinned
  exactly, installed through the lockfile, added in the sitting that first imports them (S2), the images
  rebuilt right after the install so the running stack has them.
- **Safety**: both read untrusted files. Only text comes out (never HTML); the file is read in
  memory from the upload, never written to disk; a 5 MB file limit (checked in the browser and
  again by the action; Next's server-action body limit, 1 MB by default, is raised to 6 MB in
  `web/next.config.ts`) and a 100,000-character text limit (`.length`) apply before and after
  extraction; the file type is decided by extension, never the browser's MIME type; a file whose text is empty after trimming (a scanned
  PDF) is refused.

## R4. The resume inside data markers (spec edge case)

- **Decision**: when a profile is extracted, the resume reaches the model only through a
  `get_resume` tool declared `outsideText: true`, so the loop wraps it in the run's markers. When
  jobs are scored, the first user message changes from `My resume:\n\n<text>` to the resume
  wrapped in the run's markers, in all three choices of FR-010. Like tool results, the resume and
  profile are scrubbed of look-alike markers (`scrubText`) first, and a removal is traced.
- **The system prompt stays unchanged**: its data sentence names tool results, and the first user
  message says itself that the resume is between the markers, so the rubric, the snapshot and
  every variant's `{data}` are untouched.
- **Rationale**: an uploaded PDF or Word file can carry text the owner never sees (white text,
  hidden runs); the spec puts the resume inside the markers in both places, and feature 009's rule
  is that such text is data.
- **Approved by the owner (2026-11-05).**
- **Consequence for the owner**: the "resume only" prompt changes once, by the wrapping. Its effect
  is measured with the eval harness before this sitting merges (a run on main, then a run on the
  branch, over the same cases), and `tests/prompt.test.ts`'s "stay outside any marker" test is reversed in the same commit (the
  snapshot pins the system prompt only, so it doesn't change). The baseline run is the first step
  of S4, on the freshly cut branch before any change.

## R5. Extracting the profile (FR-005, FR-006)

- **Decision**: a short agent session (`src/resumeProfile/extract.ts`), like a re-score's: a new
  system prompt with the data sentence; two tools, `get_resume` (`outsideText: true`) and
  `record_profile` (`summary` ≤ 4,000 chars; `skills` 1..100 items, each `{ name: 1..80 chars,
  group: "engineering" | "people" | "project" }`), parsed by zod; limits of 4 steps and 3 minutes.
  Duplicate skill names (case-insensitive) are kept once, in their first group. Edits use a
  second schema allowing 0..100 skills, and refuse a name already listed (ignoring case). Nothing is stored
  unless `record_profile` succeeds. Started by the owner from the Settings page through a server
  action that waits for it (a new pattern: Re-score answers at once and runs in `after()`; a proxy
  in front of the app must allow a 3-minute request). `onLookalike` traces only, as there is no
  job to flag. The chat is given a response log that keeps only usage (`usageOnlyLog`), since
  `createChat` logs every raw response to `MYJOBBOT_LOG_DIR` and `record_profile`'s arguments are
  the profile; the trace goes to `data/runs/` like a run's (the model's conversation), never to
  the re-score log tables.
- **Rationale**: the same loop, markers and validation the app already trusts; a schema-checked
  tool call instead of parsing free text; the owner sees "Extracting…" for at most three minutes.

## R6. What the model reads about the owner (FR-010)

- **Decision**: a new search setting `resume_view`: `"resume"` (default), `"resume_and_profile"`,
  `"profile"`, edited in the Settings page's Scoring section, stored in `user_settings` through
  `SearchSettingsStore` and validated by `settingsSchema`. One function, `ownerMessage(config,
  markers, closing)` (the profile travels in `AppConfig.profile`, within the 3-parameter limit), builds the first user message for runs (`src/agent/prompt.ts`),
  re-scores (`src/rescore/prompt.ts`) and eval runs:
  - `resume`: the resume inside markers, then the closing line;
  - `resume_and_profile`: the resume, then "What to look for in a job posting, from my resume:"
    with the skills by group (Engineering, People, Project), all inside markers;
  - `profile`: "My resume isn't included; judge fit with it from this profile.", then the summary
    and the skills by group, inside markers.
  With no profile stored, every choice reads as `resume`; a stale profile is still used (the
  Settings page marks it).
- **Rationale**: one builder, so runs and re-scores can't drift; markers around everything that
  came from a file or the model.

## R7. The eval harness (FR-011)

- **Decision**: 020's profile file gains an optional `resumeProfile` (`summary`, `skills`) frozen at
  capture, included in the profile's content id when present. `eval run --view resume|resume_and_profile|profile`
  picks the choice for that run (default `resume` whatever the stored setting, so runs stay comparable), the run records `view`,
  and a series test gains an optional `+view` after the variant
  (`--test both=code+resume_and_profile@llama3:8b`): variant names hold no `+`, and everything after
  `@` stays the model, colons included. `configFor` swaps in the case's `resumeProfile` and the
  run's view. A view that needs a profile on a case whose profile has none is
  refused before any model call.
- **Rationale**: the three choices become comparable like any runs, a series included, as the
  owner asked.

## R8. Settings page

- **Decision**: a new "Resume" section on the Settings page: an upload form (one file input and an
  Upload button) whose server action reads the file through R3's readers and saves through
  `ResumeStore`; the stored resume shown as text (a `pre`, never Markdown or HTML) with its name and
  upload time; the profile below it: the summary (an editable text area), the skills as three tag
  clouds (Engineering, People, Project, as in feature 018's Pico tag clouds) with add, remove and
  move, saved on each change and the summary on blur through `useProfileSave` (`useAutoSave` is
  tied to search settings, `useSave` to forms); "Extract profile" (and "Extract again",
  which confirms before replacing an edited profile); "Use summary in Preferences", which copies
  the summary into the Preferences box without saving it, through a client provider
  (`PreferencesDraft`) wrapping both sections, since the page is a server component and each
  section keeps its own state today. The section sits after Preferences; "Extract again" confirms
  with a Pico `<dialog>`.
- **Rationale**: reuses the page's patterns (sections, auto-save, tag clouds, `useSave`), Pico
  first.

## R9. Sittings and the stack

- S1 storage, runs reading the stored resume, and the upload and view of text files (one sitting,
  so `saveResume` has its production caller, the upload, in the sitting that creates it; the
  migration stops the stack); S2 PDF and Word (the new libraries; UI work, the stack may run, its
  images rebuilt right after the install); S3 extraction and the profile editor (UI work); S4 the scoring
  setting, `ownerMessage` and the eval view (run path: stack stopped); S5 docs.

## R10. Test mix

- Baseline (main after #108, 2026-11-05): 922 unit, 70 integration, 64 UI (1,056). Planned new: 39
  unit, 4 integration (the migration, and three store contract cases on MariaDB, each also run on
  memory as a unit test), 3 UI → 961 / 74 / 67 (87.3% → 87.2% unit of 1,102). The integration share
  rises slightly (6.63% → 6.72%) because a new table needs its contract on MariaDB; the unit share stays
  near 87%.
