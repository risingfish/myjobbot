# Specification Quality Checklist: Settings in the database

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- The owner answered five questions on 2026-10-25 (recorded under Clarifications in the spec):
  - the upgrade imports `config.json`'s search settings automatically, once
  - search settings are changed through command-line export and import; the Settings page editor
    comes later
  - bad stored search settings fall back one at a time, with a warning
  - only the search settings move; runtime settings stay in `config.json`
  - search settings belong to a user, ready for a later multi-user feature
- The spec names setting keys, `config.json`, `.env` and today's checks file. The feature is about
  moving some of those, so they are the domain's own terms, not a chosen design. How the settings
  are laid out in the database is left to the plan.
- Settled by the plan (research R2–R7): fallbacks are per entry inside lists and maps, and per key
  otherwise (runtime settings are never sanitized); the commands are `export-settings` and
  `import-settings`; the upgrade import never renames or rewrites the file.
- Revised on 2026-10-25 after the deep analysis: a fresh install shows the web UI's error page
  until settings are imported, an exported `{}` is refused on import, runtime keys are refused only
  by the command-line import, and fallback reports name an entry's position, never its value. After the second analysis: the
upgrade import happens on the first read of settings (a run or a page load), not at process start,
and a list whose entries all fall back takes its default (owner's analysis fixes, 2026-10-25).
