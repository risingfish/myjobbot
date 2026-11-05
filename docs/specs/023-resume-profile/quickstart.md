# Quickstart: validating the resume profile

## Prerequisites

- `.env` with `MYJOBBOT_DB_*` and `LLM_*`; the database reachable.
- The Docker stack stopped for S1 and S4 (migration, run path); it may run for S2 and S3 (UI).

## Automated checks (every PR)

```bash
npm run check
npm run check:db
```

## Manual validation

1. **Storage (S1).** With nothing uploaded, a re-score's trace shows `data/resume.md`'s text in the
   first user message. Upload a resume (or save one through the store with a script against
   `myjobbot_dev`): the next re-score uses it. Move `data/resume.md` aside with nothing uploaded: a
   re-score stops with "No resume: upload one on the Settings page" and the page says "No resume
   yet"; put it back.
2. **Upload (S1).** Upload `resume.md` on the Settings page: its text shows as text, with the file
   name and time. Upload an empty file, a `.png` and a 6 MB file: each is refused with its
   message (the large one by the browser), the stored resume unchanged. Upload a 2 MB text file:
   accepted (over Next's default 1 MB body limit).
3. **PDF and Word (S2).** Upload the same resume saved as PDF and as `.docx`: the text shown matches
   the Markdown's words. Upload a scanned (image-only) PDF: "No text could be read from that file".
4. **Profile (S3).** Extract: a summary and skills in the three groups in under 2 minutes (3 is the
   cap). If the app runs behind a proxy, check it allows a 3-minute request. Move a
   skill, add one, remove one, edit the summary, reload: kept. Upload a new resume: "From an
   earlier resume". "Use summary in Preferences" fills the box without saving; leaving the page
   keeps the old preferences.
5. **Scoring (S4).** Capture a few cases, then `eval series save views --tag smoke --repeats 3
   --test r=code+resume --test rp=code+resume_and_profile --test p=code+profile`, run and report
   it. Set "What the model reads about you" on the Settings page; the next re-score's trace shows
   the matching first user message, inside data markers.
6. **Safety.** No resume or profile text in `data/log/` (the extraction's `*.llm.jsonl` holds only
   usage), in the web log, or in `git status`; the
   resume and profile render as text, never markup.
