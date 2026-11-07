# Data model: Login ways refactor (025)

**No database change.** No migration, no column, no table. `sign_in_methods`, `hardware_keys`,
`recovery_codes` and the rest stay exactly as 024's `data-model.md` describes them (FR-002). This
file describes the code entities the refactor introduces.

## WayEntry (catalog, client-safe)

`src/accounts/ways/catalog.ts`, plain data:

| Field | Type | Meaning |
|---|---|---|
| `kind` | `"password" \| "email_link" \| "hardware_key" \| "authenticator" \| "recovery_code"` | the way |
| `card` | `{ name: string; order: number } \| null` | its card on the Account tab, with its switch; null for recovery codes |
| `choice` | `{ name: string; order: number; field: ProofField } \| null` | its radio on the sign-in form and in "Confirm it's you"; null for email link |
| `needsMail` | `boolean` | usable only while mail is set up, and can't be switched on without it; true for email link only |
| `readyWhenOn` | `boolean` | counts as set up once switched on; true for email link only |

`ProofField` is one of:
- `{ kind: "text"; name: "password" \| "code"; label; type; autoComplete }`
- `{ kind: "key" }`, the browser's key answer

Values, unchanged from 024's UI:

| kind | card | choice |
|---|---|---|
| password | "Password", 1 | "Password", 1, password field "Password" (`current-password`) |
| email_link | "Email me a link", 2 | none |
| hardware_key | "Hardware keys", 3 | "Hardware key", 4, key |
| authenticator | "Authenticator app", 4 | "Authenticator app", 2, code field "Code from your app" (`one-time-code`) |
| recovery_code | none | "Recovery code", 3, code field "Recovery code" (`one-time-code`) |

Derived lists:
- `CARD_KINDS` replaces `METHOD_KINDS`. It is in card order, and its type `CardKind` replaces
  `MethodKind`.
- `CHOICE_KINDS` is in choice order, and its type `ChoiceKind` replaces `Way` in `WayChoice.tsx`.

## ProofWay (server)

`src/accounts/ways/registry.ts` maps every `ChoiceKind` to its `ProofWay`:

| Member | Purpose |
|---|---|
| `kind` | the `ChoiceKind` |
| `readProof(fields: { password?: string; code?: string; response?: unknown })` | the proof from the submitted fields, or null |
| `matches(ctx, account: Account \| null, proof, address)` | whether the proof is right for the account (and spends what it spends: TOTP step, recovery code, key challenge) |

`IdentityProof` in `confirmIdentity.ts` keeps its flat shape, `{ method: ChoiceKind } & ProofFields`
(`{ method: "password", password }`, `{ method: "authenticator", code }` and so on). Its callers and
tests are therefore unchanged (FR-003). `confirmIdentity` hands it to `PROOF_WAYS[method].readProof`,
which reads exactly those fields, and then to `matches`. In S3 the step-up action's zod union is
replaced by `CHOICE_KINDS` plus the way's own `readProof`.

## AuthenticatorStore

The rows are the same, in a new store with the same operations, moved out of `MethodStore`:

```
authenticator(userId): AuthenticatorRow
saveAuthenticator(userId, { sealedSecret, ready }, now)
removeAuthenticator(userId, { mailOn }, now): "ok" | "last_way"
acceptStep(userId, step): boolean
```

These are added to `Stores` as `authenticators` and to `AuthContext.stores`.
