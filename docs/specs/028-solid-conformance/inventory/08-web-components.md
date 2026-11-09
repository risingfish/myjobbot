# Web UI components and hooks

Reviewed: 72 modules, 6 findings.

## Modules

| Module | Outcome |
|---|---|
| `web/components/account/AccountView.tsx` | K4, K6 |
| `web/components/account/AuthenticatorControls.tsx` | K6 |
| `web/components/account/CreateAccountForm.tsx` | K6 |
| `web/components/account/EmailChange.tsx` | K6 |
| `web/components/account/EmailLinkControls.tsx` | K6 |
| `web/components/account/Field.tsx` | none |
| `web/components/account/KeyControls.tsx` | K6 |
| `web/components/account/LinkButton.tsx` | K1, K6 |
| `web/components/account/PasswordControls.tsx` | K6 |
| `web/components/account/RecoveryCodes.tsx` | K6 |
| `web/components/account/SignInForm.tsx` | K6 |
| `web/components/account/SignInsPanel.tsx` | K4, K6 |
| `web/components/account/SignOutButton.tsx` | K6 |
| `web/components/account/StepUp.tsx` | K6 |
| `web/components/account/WayCard.tsx` | none |
| `web/components/account/WayChoice.tsx` | none |
| `web/components/common/BulletList.tsx` | none |
| `web/components/common/ExternalLink.tsx` | none |
| `web/components/common/PostingLink.tsx` | none |
| `web/components/forms/AppliedButton.tsx` | none |
| `web/components/forms/HideButton.tsx` | none |
| `web/components/forms/SaveFailedNote.tsx` | none |
| `web/components/menus/Nav.tsx` | none |
| `web/components/pages/DataPage.tsx` | none |
| `web/components/pages/RowsList.tsx` | none |
| `web/components/panel/DescriptionSection.tsx` | none |
| `web/components/panel/DetailsPanel.tsx` | none |
| `web/components/panel/HistorySection.tsx` | none |
| `web/components/panel/JobSection.tsx` | none |
| `web/components/panel/MarkdownText.tsx` | none |
| `web/components/panel/PanelHeader.tsx` | none |
| `web/components/panel/PanelRescore.tsx` | none |
| `web/components/panel/PanelSection.tsx` | none |
| `web/components/panel/RescoreTerminal.tsx` | none |
| `web/components/panel/ScoreSection.tsx` | none |
| `web/components/panel/WarningsSection.tsx` | none |
| `web/components/sections/Footer.tsx` | none |
| `web/components/sections/Header.tsx` | none |
| `web/components/sections/Panel.tsx` | none |
| `web/components/sections/TitleBar.tsx` | none |
| `web/components/settings/AddSource.tsx` | K6 |
| `web/components/settings/AdminSection.tsx` | K4, K6 |
| `web/components/settings/BoostCards.tsx` | none |
| `web/components/settings/BoostTags.tsx` | none |
| `web/components/settings/CheckNow.tsx` | K6 |
| `web/components/settings/ConnectForm.tsx` | K6 |
| `web/components/settings/DisconnectButton.tsx` | K6 |
| `web/components/settings/FiltersSection.tsx` | K5 |
| `web/components/settings/GmailPanel.tsx` | none |
| `web/components/settings/PreferencesDraft.tsx` | none |
| `web/components/settings/PreferencesSection.tsx` | none |
| `web/components/settings/ProfileEditor.tsx` | none |
| `web/components/settings/ResumeSection.tsx` | K6 |
| `web/components/settings/ScoringSection.tsx` | none |
| `web/components/settings/SettingParts.tsx` | none |
| `web/components/settings/SettingsNotices.tsx` | K3 |
| `web/components/settings/SkillClouds.tsx` | none |
| `web/components/settings/SourceControls.tsx` | K6 |
| `web/components/settings/SourceEditor.tsx` | K2, K6 |
| `web/components/settings/SourcesSection.tsx` | none |
| `web/components/settings/Tags.tsx` | none |
| `web/components/tables/AppliedMark.tsx` | none |
| `web/components/tables/DataTable.tsx` | none |
| `web/components/tables/JobCells.tsx` | none |
| `web/components/tables/JobRow.tsx` | none |
| `web/components/tables/LoadMore.tsx` | none |
| `web/components/tables/ScoreCell.tsx` | none |
| `web/components/tables/ScoreTipCell.tsx` | none |
| `web/components/tables/Tables.tsx` | none |
| `web/components/tables/TitleCell.tsx` | none |
| `web/components/tables/VerdictRow.tsx` | none |
| `web/components/tables/Why.tsx` | none |

Considered and not reported: `WayCard`'s `CONTROLS` and `GmailPanel`'s `offers` are already registries/view-driven; `RowsList`, `DescriptionSection`, `ResumeSection` and `GmailStatus` narrow small discriminated unions (idiomatic TypeScript, not per-variant extension points); `WayChoice`/`SignInForm`/`StepUp` narrow the catalog's two proof-field shapes (`text` | `key`), which the catalog itself defines; `DataPage` is a server component at a page composition root; `DetailsPanel`'s dialog focus/dismissal hooks are private, colocated hooks of the one component that uses them.

## Findings

### K1 · OCP · `web/components/account/LinkButton.tsx:37`
- **Breach**: What each emailed-link purpose does after it is spent is spread over per-purpose branches: `Outcome` tests `answer.kind === "signin" || "step_up"` and then `=== "reset"` twice for the next link's address and label, and `LinkForm` tests `purpose === "reset"` for the password field and `signin`/`step_up` again for the redirect, beside the partial `BUTTONS`/`DONE` maps.
- **Why it matters**: adding a fifth `LinkPurpose` (the type lives in `src/db/tokenStore.ts`) compiles cleanly while silently falling into the `email_change` branch ("Back to your account") and never redirecting or asking for a password; four places must be found and edited by hand.
- **Decision**: fix
- **Fix**: replace `BUTTONS` and `DONE` with one `PURPOSES: Record<LinkPurpose, { button: string; asksPassword: boolean; after: "follow" | { text: string; href: string; label: string } }>` in `LinkButton.tsx`; `LinkForm` reads `asksPassword` and `after === "follow"`, `Outcome` reads `after`. Same text and addresses, so no visible change. Only `LinkButton.tsx` changes; the `Record` makes a new purpose a compile error until it has an entry.
- **Size**: S
- **Done**: S7b

### K2 · OCP · `web/components/settings/SourceEditor.tsx:69`
- **Breach**: `FieldInput` picks the control for a source module's field with a nested ternary on `field.input` (`"checkbox"` / `"select"` / anything else as text), building all three elements every render and keeping the one it wants.
- **Why it matters**: source modules are the project's registry-based extension point (feature 017); a module that declares a new input kind in `src/sources/module.ts` (e.g. a number) silently renders as a text box instead of failing to compile, and the component must be edited branch by branch.
- **Decision**: fix
- **Fix**: add `const INPUTS: Record<SourceField["input"], (props: { field; value; onChange }) => ReactNode>` in `SourceEditor.tsx` (text, select, checkbox renderers) and render `INPUTS[field.input](...)`. Same markup; only `SourceEditor.tsx` changes.
- **Size**: S
- **Done**: S7b

### K3 · SRP · `web/components/settings/SettingsNotices.tsx:20`
- **Breach**: the component both renders the notices panel and decides their wording, including `wholeFallback`, which classifies a fallback by matching the reason against the literal `"not a search setting"` (owned as `NOT_SEARCH` in `src/config/searchSettings.ts`) and the setting name against the `"[...]"` entry notation `sanitizeSearchSettings` produces. A decision about another module's string formats lives in a React file.
- **Why it matters**: rewording `NOT_SEARCH` or changing how entries are named in `src/config/` silently changes the panel's text with no test catching it, and `noticeLines` (three notice kinds, per-kind `if`s) can only be tested by rendering the component; other panels already get their words from `src/web/` view builders (`gmailPanel.ts`, `boostViews.ts`).
- **Decision**: fix
- **Fix**: move `noticeLines` and `wholeFallback` to a new pure `src/web/settingsNoticeLines.ts` (wording per kind in a `Record<SettingsNotice["kind"], ...>`), comparing the reason against an exported `NOT_SEARCH` from `src/config/searchSettings.ts`; add a unit test with each notice kind. `SettingsNotices.tsx` only maps the lines. Output unchanged.
- **Size**: M
- **Done**: S7a

### K4 · SRP · `web/components/account/AccountView.tsx:71`
- **Breach**: three presentation components format timestamps themselves with the same rule, `iso.slice(0, 16).replace("T", " ") + " UTC"`: `AccountView.tsx:71` (activity), `SignInsPanel.tsx:27` (last used) and `AdminSection.tsx:42` (code expiry), while `src/web/rowViews.ts` already owns that rule as `minutes()` (and `src/mail/messages.ts:18` repeats it again).
- **Why it matters**: the display format is one decision copied into four places; changing it (e.g. to the viewer's time zone, as Applied already does) means finding every copy, and none of the component copies is unit-tested.
- **Decision**: fix
- **Fix**: move `minutes()` out of `rowViews.ts` (which pulls in filter and boost code that client components should not import) into a small `src/web/minutes.ts`, with a `utcMinutes(iso)` that adds `" UTC"`; `rowViews.ts`, the three components and `src/mail/messages.ts` call it. Text unchanged.
- **Size**: M
- **Amended by the analysis (2026-11-08)**: the helper goes to `src/time/minutes.ts`, not `src/web/`, so `src/mail/messages.ts` doesn't depend on the web rules.
- **Done**: S7a

### K5 · OCP · `web/components/settings/FiltersSection.tsx:12`
- **Breach**: `TermName` and `listsOf` restate, by hand, the seven field names the filters section owns, which `src/web/settingsSections.ts` already lists (`SECTIONS`, `fieldsOf("filters")`).
- **Why it matters**: a new filter list added to `SECTIONS` (and saved by `saveSection`) does not appear on the page and nothing fails to compile: `TermName`, `LABELS`, `GROUPS` and `listsOf` must each be found and edited, and missing `listsOf` loses the list on the next autosave of the section.
- **Decision**: fix
- **Fix**: export a `FilterField` type from `settingsSections.ts` (e.g. `Exclude<FieldName, "preferences" | "match_threshold" | "resume_view" | BoostField>`) and use it for `TermName`, so `LABELS: Record<FilterField, string>` forces a label; build `listsOf` from `fieldsOf("filters")` instead of destructuring. Touches `FiltersSection.tsx` and `settingsSections.ts`.
- **Size**: S
- **Amended by the analysis (2026-11-08)**: `GROUPS` becomes `Record<FilterField, group>` too, so a new filter field fails to compile until it has a group as well as a label.
- **Done**: S7a

### K6 · DIP · `web/components/account/StepUp.tsx:5`
- **Breach**: 21 client components import their server actions directly (`web/lib/accountActions`, `authenticatorActions`, `keyActions`, `signInActions`, `adminActions`, `gmailActions`, `sourceActions`, `resumeActions`, and the browser helper `keyBrowser`) rather than receiving them as props, so their logic (e.g. `useStepUpAnswers`, `useKeyActions`) cannot be exercised with in-memory fakes without module mocking.
- **Why it matters**: UI tests of these components need `vi.mock` of the action modules; this is a small cost, as the decisions behind each action already live in `src/accounts/`, `src/web/` and the guarded action bodies, which are unit-tested on memory stores.
- **Decision**: accept (owner approved, 2026-11-08)
- **Fix**: importing a `"use server"` function into a client component is how Next.js server actions are designed to be used (constitution Principle IV); passing every action down as a prop would be a workaround with no decision left to test in the component.
- **Size**: L

## Mechanical checks

- K4: a test greps every `.ts`/`.tsx` file under `web/` and `src/` (excluding `src/web/minutes.ts`) and fails on `slice(0, 16).replace("T"`, so the timestamp format has one home.
- K3: a test greps `web/components/**` for string literals equal to any exported reason constant of `src/config/searchSettings.ts` (starting with `NOT_SEARCH`), so components never classify by another module's message text.
- K1, K2, K5: no test needed once fixed; each becomes a `Record` keyed by the variant type, so a new `LinkPurpose`, source field `input` kind or filter field fails `tsc` until it has an entry.
