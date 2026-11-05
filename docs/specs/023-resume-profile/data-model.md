# Data model: Resume profile

## `resumes` (migration `017_resume`)

| Column | Type | Rules |
|---|---|---|
| user_id | int | primary key; foreign key to `users.id`; the owner (`OWNER_ID = 1`) |
| text | mediumtext | the resume's text, 1..100,000 characters (`.length`) after trimming |
| file_name | varchar(255) | the uploaded file's name, shown back |
| file_type | varchar(8) | `md`, `txt`, `pdf` or `docx` |
| uploaded_at | varchar(32) | ISO time |
| content_id | char(16) | `sha16(text)`: first 16 hex of SHA-256 |

`utf8mb4_bin`, like every table. One row per user: an upload replaces it. Types in
`src/db/schema/resume.ts`; `saveResume` ensures the owner's `users` row first.

## `resume_profiles` (same migration)

| Column | Type | Rules |
|---|---|---|
| user_id | int | primary key; foreign key to `users.id` |
| resume_id | char(16) | the `content_id` of the resume it was extracted from |
| summary | text | ≤ 4,000 characters, preferences-style prose |
| skills | text | JSON `[{ name, group }]`, 1..100 items from an extraction, 0..100 after an edit, `name` 1..80 characters, `group` ∈ `engineering`, `people`, `project`; names unique ignoring case |
| extracted_at | varchar(32) | ISO time |
| edited_at | varchar(32) \| null | set when the owner changes the summary or skills |

A profile is **stale** when its `resume_id` differs from the stored resume's `content_id`.
Extracting again replaces it; when `edited_at` is set the Settings page asks first. A stale
profile is still used by scoring.

## Search setting `resume_view` (in `user_settings`, feature 015)

`"resume"` (default) | `"resume_and_profile"` | `"profile"`. A bad stored value falls back to
`"resume"` with the usual settings notice. Runs and re-scores follow it; eval runs don't (their
`--view`).

## Eval profile (feature 020, `profiles/<id>.json`): one optional field

| Field | Type | Rules |
|---|---|---|
| resumeProfile | `{ summary, skills }` \| absent | frozen at capture when a profile exists; included in the profile's content id when present |

## Eval run (feature 020/022, `run.json`): one optional field

| Field | Type | Rules |
|---|---|---|
| view | `"resume"` \| `"resume_and_profile"` \| `"profile"` \| absent | from `--view`, default `"resume"`; absent reads as `"resume"` |

A series test (feature 022) gains an optional `view` with the same values, written
`<label>=<variant|code>[+view][@model]`.
