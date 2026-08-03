# SAP webhook — interface contract

Inbound integration that creates inspections from SAP QM notifications. Design rationale is
in [DESIGN.md](../DESIGN.md) §5.1; this document is the contract an integrator needs.

`POST /api/sap-webhook`

## Authentication

Every request carries two headers:

| Header | Value |
|---|---|
| `X-QIT-Timestamp` | ISO 8601 instant, e.g. `2026-08-03T09:15:00.000Z` |
| `X-QIT-Signature` | `sha256=<hex>` |

The signature is **HMAC-SHA256 of `` `${timestamp}.${rawBody}` ``** using the shared secret,
where `rawBody` is the exact bytes of the request body.

Two details matter and both are deliberate:

1. **The timestamp is inside the signed string.** If only the body were signed, the timestamp
   header would be attacker-controlled — capture one valid delivery, rewrite the header to look
   fresh, and the replay window would be meaningless.
2. **The raw bytes are signed, not the parsed object.** Re-serialising JSON changes key order and
   whitespace, so a signature computed over a re-encoded body will not match. The endpoint reads
   the body as a raw buffer for exactly this reason.

Deliveries are rejected with **401** if the signature doesn't match (constant-time compare), if
either header is missing, or if the timestamp is more than **5 minutes** away from server time in
either direction. Rejected deliveries are application-logged only and never written to the event
table, so unauthenticated traffic can't fill it.

### Signing example

```js
const { createHmac } = require('node:crypto');

const rawBody = JSON.stringify(payload);
const timestamp = new Date().toISOString();
const signature =
  'sha256=' + createHmac('sha256', SECRET).update(`${timestamp}.${rawBody}`).digest('hex');

await fetch('http://localhost:4000/api/sap-webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-QIT-Timestamp': timestamp,
    'X-QIT-Signature': signature,
  },
  body: rawBody, // the same string that was signed
});
```

## Payload

```json
{
  "eventId": "evt_8f2c1a",
  "occurredAt": "2026-08-01T10:15:00.000Z",
  "notification": {
    "defectCode": "Q-HOLE-01",
    "severityCode": "CRITICAL",
    "workCenter": "LOOM-04",
    "inspectionDate": "2026-08-01",
    "description": "Warp break detected on inline scan"
  }
}
```

| Field | Notes |
|---|---|
| `eventId` | **The idempotency key.** Unique per event; redelivering the same id never creates a second inspection. |
| `occurredAt` | Instant the event happened. |
| `notification.defectCode` | SAP's defect code. Mapped through `DefectType.sapCode`. |
| `notification.severityCode` | Must be one of `CRITICAL`, `MAJOR`, `MINOR`. |
| `notification.workCenter` | Becomes `machineId`. |
| `notification.inspectionDate` | Calendar day, `YYYY-MM-DD`. Sent explicitly rather than derived from `occurredAt`, because deriving a calendar day from a UTC instant flips it either side of midnight depending on the sender's timezone. |
| `notification.description` | Optional; becomes `remarks`. |

## Two different answers to "unknown code"

This asymmetry is intentional.

**An unknown `defectCode` is accepted** (201). SAP's defect catalogue is large and evolves
without telling us, so rejecting would strand a legitimate event and make SAP retry a payload we
will never accept. The inspection is created against `OTHER` and the raw code is preserved in the
remarks as `[SAP defectCode=Q-WHATEVER-99]`, so nothing is lost and it can be reclassified later.

**An unknown `severityCode` is rejected** (400). Severity is a fixed three-value interface
contract that drives triage and the summary dashboard, so guessing would be silent data
corruption. A 4xx is also the right signal: a well-behaved sender treats it as "fix your
integration" rather than retrying forever.

Adding a mapping is a data change, not a deploy — `DefectType.sapCode` is a column in the
reference table.

## Responses

| Situation | Status | Behaviour |
|---|---|---|
| New event, processed | **201** | Inspection created with `source: "SAP"` and `externalRef: eventId` |
| Event already processed | **200** | Returns the previously created inspection; `deliveryCount` incremented |
| Unknown defect code | 201 | Mapped to `OTHER`, raw code kept in remarks |
| Bad/missing signature, stale timestamp | 401 | `INVALID_SIGNATURE`; nothing written |
| Malformed JSON, missing fields, unknown severity | 400 | `VALIDATION_ERROR`; no event row |
| Processing failure | 500 | Event marked `FAILED` (dead letter); SAP should retry |

## Delivery semantics

The endpoint is **persist-then-process**: a signature-valid event is written to
`webhook_events` before anything is acted on, so a failure becomes an inspectable dead letter
rather than a lost message.

A redelivery branches on the stored status:

- `PROCESSED` → return the prior result (200). Nothing is created.
- `RECEIVED` or `FAILED` → **re-attempt**. A previous attempt that crashed or failed is retried,
  so the dead letter heals itself. Answering 200 here would tell SAP "all good" while no
  inspection exists.

Creating the inspection and marking the event `PROCESSED` happen in **one transaction**, so a
crash between them rolls back both and a re-attempt never finds an orphan. If two first
deliveries race, the unique `eventId` constraint arbitrates — the loser reads back the winner's
event and treats its own delivery as a duplicate.

At higher volume this would become accept → **202** → queue → worker. The event log is
deliberately the seam that makes that change possible without altering this contract.

## Configuration

`SAP_WEBHOOK_SECRET` — see [api/.env.example](../api/.env.example). Required unless `NODE_ENV` is
explicitly `development` or `test`, where it falls back to `dev-secret` with a warning. An unset
or unrecognised `NODE_ENV` refuses to start rather than fall back, so a misconfigured production
box can't silently accept a publicly-known secret.
