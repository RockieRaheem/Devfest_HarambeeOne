# HarambeeOne Multi-Unit and Interoperability Plan

This plan defines how HarambeeOne separates bursar work while sharing approved learner data safely. Read it with `MVP_ROADMAP.md` before changing school identity, access, learner movement, or integration code.

## Architecture boundary

- A **school organization** is the legal institution or school network identity.
- A **school unit** is one operational campus section, such as primary or secondary, with its own bursar memberships, periods, learners, fees, payments, receipts, reconciliation, reports, and audit history.
- A user sees only units for which they hold an explicit membership and must actively select the unit they are operating.
- Financial records never move silently between units. The originating unit retains its immutable ledger and the receiving unit creates its own placement and charges.
- Sharing is deny-by-default, purpose-limited, consented where required, data-minimized, and audited.

## Delivery slices

### A. Institution and unit isolation

Status: **COMPLETE**

- Link operational school units to one organization identity.
- Permit one account to hold distinct roles in multiple units.
- Select the active unit through a server-controlled cookie and validate it against membership on every API request.
- Let an owner add another standard Ugandan section without combining its classes or finances with the current unit.
- Preserve existing installations by backfilling each school into its own organization.

### B. Staff access lifecycle

Status: **COMPLETE**

- Owner creates a time-limited invitation for a specific unit and role.
- Signed-in staff accepts the invitation; acceptance is single-use and audited.
- Owner can list, change, and revoke unit membership without deleting the user or historical actor references.
- No invitation may grant access to another organization or exceed the inviter's authority.

### C. Consented learner transfer

Status: **COMPLETE**

- Source unit creates a transfer case with guardian authorization, purpose, target unit, and minimum learner identity/placement data.
- Target unit reviews and accepts or rejects the case.
- Acceptance creates a new target learner identity link and placement; it never copies payments, rewrites the source ledger, or exposes unrelated guardian data.
- Both units retain matching transfer references, timestamps, actors, consent evidence, and status history.
- Duplicate acceptance and retry are idempotent.

### D. External system exchange

Status: **COMPLETE**

- Versioned canonical JSON resources with stable organization, unit, learner, and transfer identifiers.
- Scoped service accounts, credential rotation, rate limits, signed webhooks, idempotency keys, and an outbox delivery log.
- Canonical Uganda programme/class codes remain separate from local display names.
- Every export records recipient, purpose, fields, lawful authority/consent, actor, and correlation ID.
- Import validation quarantines conflicts instead of overwriting trusted records.

## Completion standard

The capability is not complete until role isolation, cross-unit denial, invitation expiry/replay, consent, transfer retry, source-history preservation, webhook retry, signature verification, and audit evidence all pass automated tests and production database verification.
