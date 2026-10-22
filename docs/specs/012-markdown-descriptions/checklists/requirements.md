# Specification Quality Checklist: Markdown job descriptions

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-22
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

- Revised the same day from "store cleaned HTML" to "convert to Markdown" at the owner's request.
- Seven questions were answered (2026-10-22, recorded under Clarifications): HTML becomes Markdown;
  Markdown replaces the plain text everywhere; links work in a new tab; careers pages are converted
  too; Lever's whole posting is kept; the model's copy has no link addresses; every job is scored
  again once when it changes to Markdown.
- The deep analysis (2026-10-22) added code blocks to FR-002, the emptied-element edge case, and how
  the careers lookup's model reads board-data pages (Assumptions). The delta check (same day)
  corrected the Workday escaping edge case, dropped "and filters" from FR-010, extended FR-014 to
  rows with no recorded format, reworded SC-003 and SC-005 for Lever's added content, and noted that
  a board's conversion needs a configured company.
- Added from the answers: FR-010 (boosts and filters ignore link addresses and Markdown symbols),
  FR-011 (older plain-text rows keep showing as today) and SC-005 (boost terms unchanged).
- HTML, Markdown, `http`/`https` and `javascript:` are named because they are the subject of the
  feature, not implementation choices. Source paths appear only in the quoted input.
- Any conversion or display library is deliberately left to planning, where the constitution
  requires presenting options to the owner.
