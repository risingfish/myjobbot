# Contract: the Settings page's Resume section and the scoring message

## Resume section (Settings page)

- **Upload**: one file input (`.md`, `.txt`, `.pdf`, `.docx`) and an Upload button. The browser
  refuses a file over 5 MB before sending, with the same message; the server-action body limit is
  6 MB (`web/next.config.ts`). The server action `uploadResume(formData)` checks the type (by
  extension) and the 5 MB limit, reads the text (R3), checks
  1..100,000 characters (`.length`), saves through `ResumeStore.saveResume`, and answers `{ ok: true, resume }`
  or `{ ok: false, error }` with a fixed message:
  `That file type isn't supported (use .md, .txt, .pdf or .docx)` ·
  `That file is over 5 MB` · `No text could be read from that file` ·
  `The resume is over 100,000 characters` · `That file couldn't be read`.
- **Shown**: the file name, `uploaded <time>`, and the text in a `pre` (never rendered as Markdown
  or HTML). With no upload: "Using data/resume.md" and that file's text; with neither, "No resume yet".
- **Placement**: after the Preferences section.
- **Profile**: "Extract profile" (or "Extract again", confirming first in a Pico `<dialog>` when
  the profile was edited)
  calls `extractResumeProfile()`, which waits for the model (at most 3 minutes) and answers the
  profile or `{ ok: false, error: "The profile couldn't be extracted; nothing was changed" }`. The
  summary is an editable text area; the skills are three tag clouds (Engineering, People, Project)
  with add, remove and a move control; skill changes save at once and the summary on blur
  (`saveResumeProfile` through `useProfileSave`, `SaveFailedNote` on failure). Removing every skill
  is allowed; adding a name already listed (ignoring case) is refused: `That skill is already
  listed`. A stale
  profile shows "From an earlier resume".
- **Use summary in Preferences**: copies the summary into the Preferences section's text box
  (through `PreferencesDraft`), marks it edited so its Save bar shows, scrolls to it, and doesn't
  save.

## Scoring section

- A select, **What the model reads about you**: "Your resume" (`resume`), "Your resume and
  profile" (`resume_and_profile`), "Your profile only" (`profile`), saved with the section as
  today (feature 016). Runs and re-scores follow it; eval runs use `--view`.

## The first user message (runs, re-scores, eval runs)

```text
My resume, between the data markers:

<<data tag>>
…resume text…
<</data tag>>

<closing line>
```

With `resume_and_profile`, inside the same markers after the resume:

```text
What to look for in a job posting, from my resume:
Engineering: TypeScript, Kubernetes, …
People: mentoring, hiring, …
Project: roadmaps, …
```

With `profile`, the markers hold the line "My resume isn't included; judge fit with it from this
profile.", then the summary and the three skill lines.

The resume and profile are scrubbed of look-alike markers before wrapping. A stale profile is
still used. With no profile every choice reads as `resume`. The system prompt is unchanged.

## `eval run --view <resume|resume_and_profile|profile>`; series `--test <label>=<variant|code>[+view][@model]`

`--view` defaults to `resume`, whatever the stored setting. The run records `view`; the report header adds `· view <view>` unless it is `resume`. A view that
needs a profile, on a case whose profile has none, refuses the run before any model call:
`refused view <view>: case <id> was captured without a resume profile` (for `profile` and
`resume_and_profile`). Everything after `@` is the model, colons included.
