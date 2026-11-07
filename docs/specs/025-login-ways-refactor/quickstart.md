# Quickstart: validating the login ways refactor (025)

Nothing here is new behaviour. Each check proves 024 still works as it did, plus the structure
the spec asks for. 024's [quickstart](../024-user-accounts/quickstart.md) is the reference.

## 1. The suites

- `npm run check` and `npm run check:db` are green after every sitting.
- Test counts only grow by the new tests named in the plan (SC-001). No existing test's `expect`
  lines change. `git diff main -- tests/` shows only imports, store construction, contract
  cases moving between files, and calls to `signInByWay` where a removed sign-in function was
  called with the same inputs (FR-003).

## 2. Structure (SC-002 – SC-005)

1. `tests/wayBranches.test.ts` passes: no way kind is compared as a literal outside
   `src/accounts/ways/`, the way controls in `web/components/account/` and the stores.
2. `grep -rn "METHOD_KINDS\|WAY_NAMES\|const WAYS" src web` finds only
   `src/accounts/ways/catalog.ts` (its private `const WAYS`), the one list.
3. `grep -rn "forUpdate" src/db/kysely/methodStore.ts src/db/kysely/keyStore.ts src/db/kysely/authenticatorStore.ts`
   finds nothing. The lock lives in `wayLock.ts` alone.
4. `grep -rn "const SIGNED_OUT" web` finds one, in `web/lib/accountAction.ts`.
5. Review: adding a sixth way means its module in `src/accounts/ways/`, a catalog entry, a
   registry entry and its controls component, and nothing else.

## 3. Browser walk (SC-006)

With the stack rebuilt after the merge (or `npm run web` on the branch, `MYJOBBOT_*` taken from
`.env` only), repeat 024's quickstart:

- §2.3–2.5: password sign-in and the lock after five failures
- §5.2–5.3: "Confirm it's you", `last_way`
- §5.4: email link
- §6.1–6.3: authenticator and recovery code
- §7: hardware key

Every message, card name, radio order and recorded event matches 024.
