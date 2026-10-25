# HarambeeOne Integration API v1

This document is the contract for approved systems exchanging learner-placement data with one HarambeeOne school section. Connections are created by a section owner in **Control → Connected systems**. They never receive database credentials.

## Authentication and boundaries

Send the one-time-issued service credential on every integration request:

```http
Authorization: Bearer hbo_live_...
```

Each credential is permanently bound to one school section, a documented purpose and lawful authority, explicit scopes, explicit field groups, an expiry if configured, and a per-minute rate limit. Rotate or revoke it from the Connected systems workspace. A rotation invalidates the previous credential immediately.

Supported scopes:

- `learners:read`
- `transfers:read`
- `imports:write`

Supported field groups:

- `identity`: stable learner ID, local student ID, admission number and status.
- `demographics`: learner name, date of birth, gender and nationality.
- `placement`: period, class, canonical Uganda class code and stream.
- `guardian_contact`: primary guardian name and contact details. This is disabled by default and should be granted only when strictly required.

## Canonical exports

### Learners

```http
GET /api/integration/v1/learners?limit=100&cursor=<student-uuid>
X-Correlation-ID: partner-generated-reference
```

The response uses `schema_version: "harambeeone.v1"`, identifies the legal organization and operational unit separately, and returns only the field groups granted to the credential. Use `next_cursor` until it is `null`.

### Learner transfers

```http
GET /api/integration/v1/transfers?limit=100
X-Correlation-ID: partner-generated-reference
```

Transfer resources contain the stable learner ID, source and target unit IDs, shared transfer reference, purpose, consent evidence metadata, status and timestamps. Learner demographics are included only when explicitly granted.

Every export records the recipient connection, purpose, lawful authority, fields, record count, payload hash, correlation ID, outcome and time in HarambeeOne’s exchange evidence.

## Inbound validation

```http
POST /api/integration/v1/imports
Content-Type: application/json
Authorization: Bearer hbo_live_...
```

```json
{
  "schema_version": "harambeeone.v1",
  "resource_type": "learners",
  "idempotency_key": "partner-batch-2027-001",
  "records": [
    {
      "stable_learner_id": "00000000-0000-0000-0000-000000000000",
      "organization_id": "00000000-0000-0000-0000-000000000000",
      "source_unit_id": "00000000-0000-0000-0000-000000000000",
      "local_student_id": null,
      "admission_no": "P-001",
      "status": "active",
      "first_name": "Amina",
      "last_name": "Nabirye",
      "canonical_class_code": "P7"
    }
  ]
}
```

The same idempotency key and payload returns the original batch. Reusing a key with different data returns `409`. Incoming records are staged for review: mismatches with trusted organization, identity, admission, status, name or canonical placement data are quarantined and never overwrite school records. Owners acknowledge or reject staged batches in the Connected systems workspace.

## Signed webhooks

Webhook subscriptions currently support:

- `learner.transfer.created`
- `learner.transfer.accepted`
- `learner.transfer.rejected`
- `learner.transfer.cancelled`
- `integration.test`

The signing secret is shown only when a webhook is created or rotated. Each request contains:

```text
X-Harambee-Event-ID: <uuid>
X-Harambee-Timestamp: <unix-seconds>
X-Harambee-Signature: v1=<hex-hmac-sha256>
```

Verify the signature by computing HMAC-SHA256 with the webhook secret over:

```text
<X-Harambee-Timestamp>.<exact raw request body>
```

Use a constant-time comparison, reject timestamps outside your replay window, and deduplicate with `X-Harambee-Event-ID`. Return any `2xx` status only after safely accepting the event. HarambeeOne retains failed attempts, applies exponential retry timing up to eight attempts, and supports controlled retry from the owner workspace.

Production webhook URLs must use HTTPS and resolve to public addresses. Private-network targets are rejected to prevent server-side request forgery; localhost HTTP is permitted only in development.

## Errors

- `401`: missing, invalid, expired, rotated or revoked credential.
- `403`: valid credential without the required scope.
- `409`: duplicate name/URL or idempotency-key conflict.
- `422`: invalid schema, unsupported field/event, unsafe webhook URL or validation error.
- `429`: connection rate limit exceeded.

HarambeeOne’s OpenAPI document at `/openapi.json` is the machine-readable source for request and response validation.
