# Validation guide: Split the README (026)

How to prove the feature is done. Run from the repository root of the checkout doing the work.

## 1. The README's shape (SC-001, SC-002, FR-001)

```bash
wc -l README.md                         # ≤ 250
grep -n '^## ' README.md                # Quickstart, The parts, Job sources, How scoring works, Further reading, License
grep -n 'docker compose -f compose.full.yaml' README.md | head -1   # first quickstart command, line ≤ 40
```

## 2. Every page exists and is linked (FR-008, FR-010)

```bash
for p in how-it-works cli sources database developing deploying; do
  test -f docs/$p.md && grep -q "docs/$p.md" README.md && head -3 docs/$p.md | grep -q 'README' && echo "ok $p"
done                                    # six "ok" lines
```

## 3. No broken links (SC-004, FR-011)

Run the one-off link checker from the session scratchpad (research R7) over `README.md` and
`docs/*.md`. Expected: `0 broken`.

## 4. Nothing lost (SC-003, SC-005, FR-009)

Walk `data-model.md`'s content map: for each of its rows, search the new pages for a distinctive
phrase or value from that block of today's README (`git show 693a827:README.md`). Record 20 sampled
facts and the page and heading each was found under in the sitting's notes. Expected: every row
found, each fact in one page.

Spot checks that must hold:

```bash
grep -l 'render_seconds' README.md docs/*.md          # docs/how-it-works.md only
grep -l 'Mark as not applied' README.md docs/*.md     # docs/how-it-works.md only
grep -l 'against observed' README.md docs/*.md        # docs/cli.md only
grep -l 'mysqldump --single-transaction' README.md docs/*.md   # docs/developing.md only
```

## 5. Corrections applied (research R6)

```bash
grep -n 'top_k\|OpenAI-compatible' README.md          # the LLM row says what R1 says
grep -n 'resume.md' README.md                         # required for Docker, optional with npm once uploaded
```

## 5a. Proxies (FR-015)

```bash
grep -n 'MetalLB' docs/deploying.md                                   # the counting rule is there
grep -n -A6 'trustedProxies' deploy/helm/myjobbot/values.yaml        # the owner's fuller comment, verbatim
helm template t deploy/helm/myjobbot >/dev/null && echo chart ok      # comment change breaks nothing (if helm is installed)
```

## 6. Project references (FR-012)

```bash
grep -n 'README' CLAUDE.md .env.example .specify/memory/constitution.md
```

Expected: no reference to a README section that moved; the Evals and Develop pointers name
`docs/cli.md` and `docs/developing.md`.

## 7. The full-stack file (FR-003, FR-014)

```bash
docker compose -f compose.full.yaml config --quiet && echo config ok    # never without --quiet
```

Fresh-clone bring-up, under its own project name and port so it can't touch the running stack or
any real database:

```bash
git clone . "$SCRATCH/full" && cd "$SCRATCH/full"
cp .env.example .env    # fill LLM_*, MYJOBBOT_HOSTS=localhost:8099, MYJOBBOT_PORT=8099,
                        # MYJOBBOT_BASE_URL=http://localhost:8099,
                        # MYJOBBOT_DB_NAME/_USER/_PASSWORD (throwaway values), SEARXNG_SECRET
mkdir -p data && cp examples/config.json examples/resume.md data/
docker compose -p myjobbot-fulltest -f compose.full.yaml up -d --build
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: localhost:8099' http://localhost:8099/sign-in   # 200
docker compose -p myjobbot-fulltest -f compose.full.yaml exec mariadb sh -c \
  'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" -N -e "SELECT COUNT(*) FROM kysely_migration"'   # = steps in src/db/migrations/index.ts
docker compose -p myjobbot-fulltest -f compose.full.yaml exec web npm start -- account init test@example.com   # type a throwaway password; then sign in at http://localhost:8099
docker compose -p myjobbot-fulltest -f compose.full.yaml down -v                            # removes the throwaway database
```

Expected: 200, every migration step recorded, the first admin made and signed in, and nothing left behind after `down -v`. Never print `.env`.

## 7a. No app code changed (FR-013)

```bash
git diff --stat 693a827 -- src web tests docker; git status --short -- src web tests docker   # both empty
```

## 8. The gate

```bash
npm run check
```

Green (no code changed, so this confirms nothing else moved). `npm run check:db` is skipped for this
documentation-only feature (owner decision, 2026-11-07).
