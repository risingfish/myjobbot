# Specification Quality Checklist: User accounts

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-05
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

- Decisions from the owner's 2026-11-05 question session are recorded under Clarifications.
- Libraries (mail, hashing, hardware keys, authenticator codes) are left to planning, with the
  owner's approval (constitution IV).
- Defaults chosen without asking (link lifetimes, attempt limits, 10 recovery codes, password-only
  new accounts, first-admin reset option, admin email change, "someone tried your address" notice)
  were reviewed and accepted by the owner on 2026-11-05.
- Security was made the first concern (owner, 2026-11-05): "Security model" table and FR-033 to
  FR-052 (CSRF, session handling, timing, one-time values, link scanners, referrer, open redirect,
  framing, content policy, header injection, step-up checks, notices, key/TOTP checks, sealed
  secrets, security events, error details), with SC-009 to SC-013.
- Re-validated after the security additions: all items still pass; requirements name protections,
  not libraries or frameworks.
- Updated 2026-11-06 after `/speckit-analyze-deep`, with the owner's decisions: step-up also by an
  emailed confirmation link (FR-047, US3-7), an admin may remove their own mark while another admin
  remains (FR-012, US2-7), a reset link signs no one in and a changed admin mark ends the account's
  other sign-ins (FR-026, FR-037), mail turned off and direct clients without a trusted proxy
  (Edge Cases, Assumptions). Re-validated: all items still pass.
- 2026-11-06 (owner): a signed-out browser is taken to the sign-in page and gets no job data at all
  (FR-053; Security model row; US1-3; edge cases for background requests, Back and in-page
  navigation; SC-001). Built by T016/T017 (proxy 303/401 with no data, `no-store`, `requireSession()`
  in every page loader, `guarded` redirecting every signed-out action) and tested by T008, T010,
  T011 and quickstart §2.8–§2.10. All checklist items still pass.
- 2026-11-06 (owner): new pages use Pico's own elements, roles and variables first (research R18,
  plan UI line, tasks cross-cutting rule, T069 review).
- 2026-11-06 (owner, after `/speckit-analyze-deep delta`): with mail off, the sign-in page's "Email
  me a link" and "Forgot password" answer "Email isn't set up on this server." for every email
  (FR-023, FR-029, US4-4); "Sign out everywhere else" is in FR-047's step-up list; a signed-out
  server action gets a redirect to sign-in from `guarded`, not the proxy's 401 (FR-053);
  `scripts/copy-prod.sh` copies no sessions or one-time values (research R19, T064–T065). All
  checklist items still pass.
