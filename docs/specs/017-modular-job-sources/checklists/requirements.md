# Specification Quality Checklist: Modular job sources

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-28
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

- The owner answered both markers on 2026-10-28 (recorded under Clarifications in the spec):
  - a source whose test fetch fails is saved and marked as failing (FR-017);
  - the owner decides what is fetched by turning sources on or off; every source that is on is
    fetched each run, and the model only scores (FR-016).
- /speckit-clarify on 2026-10-28 settled three more (Clarifications in the spec):
  - each saved source is added and edited on its own, with its own Save and test (FR-005);
  - a source stopped at its per-run limit continues from there next run, wrapping round after its
    last page (FR-007a);
  - each module's schedule applies to all its sources, with no per-source refresh setting (FR-009a).
- The spec names the module interface's parts, the platforms and the owner's terms (saved source, board). They are the feature's subject and the owner's own design (2026-10-28 discussion), not a chosen implementation.
- Decided with the owner before specifying (2026-10-28):
  - saved searches move into the same table as boards;
  - modules are code shipped with the app;
  - scraping is out of scope, though the interface allows it;
  - JSearch stays app-wide;
  - Workday's ATS side becomes a module.
- After the deep analysis (2026-10-28), the spec also covers: a suggested name's rule, Gmail alerts
  created when Gmail connects, duplicate boards merged on the upgrade, and a fresh install's upgrade
  doing nothing.
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
