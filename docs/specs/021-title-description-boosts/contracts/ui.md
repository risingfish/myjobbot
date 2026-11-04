# UI contract: Title and description boosts

## Settings page, Scoring section

```text
┌ Scoring ─────────────────────────────────────────────────────────────┐
│ ┌ Threshold ──────────────┐                                          │
│ │ Match threshold [ 70 ]  │                                          │
│ └─────────────────────────┘                                          │
│ ┌ Title boosts ─────────────────┐ ┌ Description boosts ────────────┐ │   Pico .grid: side by side
│ │ senior: 5 ✎ ×  backend: 5 ✎ × │ │ typescript: 10 ✎ ×  react: 8 … │ │   when wide, stacked when
│ │ [Term] [1] [Add]   Reset      │ │ [Term] [1] [Add]   Reset       │ │   narrow (same as Filters)
│ │ problems for this list        │ │ problems for this list         │ │
│ └───────────────────────────────┘ └────────────────────────────────┘ │
│ Saved ✓                                                              │
└──────────────────────────────────────────────────────────────────────┘
```

- The two cards are `<article>`s titled "Title boosts" and "Description boosts". `BoostCards`
  takes `{ view, lists, result, onChange }`, where `lists` holds both fields' rows and
  `onChange(field)(rows)` saves one; it maps over `BOOST_FIELDS`.
- Each card is a `SettingCard` holding one `Setting` (label "Title boosts" / "Description boosts",
  its own default marker and Reset) wrapping `BoostTags` for that field, then `Problems` for that
  field. The tag cloud's accessible label is the card's label.
- Any change in either card, or a reset, saves the whole `scoring` section at once (threshold and
  both lists), as today; a typed threshold still saves on blur or Enter.
- A term repeated within one card: that row shows "this term is already boosted above", nothing is
  saved. The same term in the other card is accepted.
- Inputs, buttons and the remove confirm are labelled per list, so the two cards are
  distinguishable: "Title boost term" / "Description boost points", "Edit the title boost for
  senior", "Remove the description boost for react", and `Remove the description boost for
  "react"?`.

## Jobs table: score cell note

`base 30 + bonus 32 · model 62 · +15 senior +5 (title), typescript +10 (description)`

- The boost part appears only when a boost applied; terms in the order of `Boost.applied`; a term
  found in both places reads `react +10 (title and description)`.

## Details panel: Score section

| Fact | Value |
|------|-------|
| Score | boosted total (capped at 100) |
| Model's score | unchanged |
| Boosts | "none", or "+15" followed by one line per applied term: `senior +5 (title)`, `typescript +10 (description)` (a `FactLines` in `PanelSection`: the total, then a `<ul>` of the lines, inside the `<dd>`) |
| Resume fit / Preference fit / Scored | unchanged |

The fact formerly labelled "Title boost" is renamed "Boosts".
