# myjobbot

An autonomous agent that pulls software-engineering postings from company job boards
(Greenhouse, Lever, Ashby), scores them against your resume with a local LLM, and keeps
history in SQLite to spot long-open "ghost" postings.

Design: `docs/superpowers/specs/2026-10-03-myjobbot-design.md`

## Setup

```bash
npm ci
cp .env.example .env            # set LLM_API_KEY
mkdir -p data
cp examples/config.yaml data/   # list your target companies
cp examples/resume.md data/     # replace with your resume
```

The LLM server must be llama.cpp `llama-server` started with `--jinja` and a
tool-calling model.

## Run

```bash
npm start -- run
```

Each run writes a JSONL trace of every model message and tool call to `data/runs/`.

## Develop

```bash
npm run check   # typecheck + tests + habit-hooks
```
