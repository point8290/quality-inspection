# Quality Inspection Tracker — Design

> Internal tool for Arvind Ltd shop-floor supervisors to log, track, and resolve quality
> defects from a phone. Covers features, system design, data model, REST API, the SAP
> integration + offline architecture, and the build plan. Sized to ship cleanly and to be
> explained line-by-line in a review.

---

## 1. Features

### Core (required)
1. **Log an inspection** — date, machine/line ID, defect type, severity, optional remarks; created **Open**.
2. **Inspections list** — mobile card list.
3. **Filter** — status, severity, defect type, inspection-date range.
4. **Sort** — inspection date, created date, or severity priority.
5. **Pagination.**
6. **Inspection detail.**
7. **Resolve** — mark Resolved with a **mandatory resolution note**; records `resolvedAt`.
8. **Resolve-once** — can't resolve twice (server-enforced, 409).
9. **Summary dashboard** — Open vs Resolved counts by severity.
10. **Managed reference data** — defect types & severities as lookup tables; dropdowns fed from the API.
11. **Mobile-first UI** at 390px, with empty/loading/error states.
12. **Consistent REST API** — envelope, status codes, edge validation.

### Committed integrations (promoted from bonus — designed production-grade)
13. **SAP webhook** — signed, idempotent inbound integration that creates inspections from SAP QM (§5.1).
14. **Offline-first** — log/resolve offline, sync on reconnect; app loads with no network (§5.2).

### Still optional (if time)
15. **JWT auth** — env-toggleable so the base app still runs in one command.

### Delivery
- One-command `docker compose up` + non-Docker README path; seed/demo data on first run.

---

## 2. System Design

### 2.1 Shape — monorepo, two services

```
quality-inspection-tracker/
├── docker-compose.yml · README.md · DESIGN.md · docs/sap-webhook.md
├── api/                      # Express + TS + Sequelize + SQLite
│   ├── config/ migrations/ seeders/ .sequelizerc
│   └── src/
│       ├── index.ts app.ts db.ts
│       ├── models/           # Severity DefectType Inspection WebhookEvent + index (associations)
│       ├── routes/           # inspections referenceData sap
│       ├── services/         # rules, resolve invariants, summary, sap ingest
│       ├── schemas/          # zod (incl. sap payload)
│       └── middleware/        # error, rawBody (webhook), auth(optional)
└── web/                      # React + Vite + TS + Tailwind (PWA)
    └── src/
        ├── app/store.ts rootSaga.ts
        ├── features/inspections/{slice,saga,selectors,components}
        ├── features/summary/{slice,saga,SummaryView}
        ├── features/reference/{slice,saga}
        ├── offline/          # db(dexie) outbox syncSaga serviceWorker
        └── api/client.ts types.ts
```

### 2.2 Stack & why
| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React + Vite + TS, **Tailwind v4** | SPA, no SSR; fast build; mobile-first. Tailwind v4 is CSS-first (`@tailwindcss/vite` + one `@import`, no JS/PostCSS config) — fewer files to defend. Vite PWA plugin gives the offline service worker. |
| State + side effects | **Redux Toolkit + Redux Saga** | RTK trims store boilerplate; Saga isolates async as one loop AND hosts the offline **sync engine** (watcher + single-flight drain + backoff) — the reason saga is worth it here. |
| Backend | Express + TS, layered routes → services → models | Thin, explicit, narratable. |
| Validation | Zod | One schema per body/query → 400 with detail; also validates the SAP payload. |
| ORM | **Sequelize** | Own migrations directly, light machinery, already familiar. Trade-off: manual TS typings. |
| DB | **SQLite** (sqlite3) | No container, instant migrations; Postgres is a dialect change behind Sequelize. |

### 2.3 Assumptions
- Single supervisor persona; auth optional. `inspectionDate` is `DATEONLY` (`YYYY-MM-DD`) — no timezone conversion; audit fields (`createdAt`/`updatedAt`/`resolvedAt`) are full timestamps. `machineId` free text.

---

## 3. Schema Design

Core tables: `Severity`, `DefectType` (lookup tables — surrogate `INTEGER` PK + unique `code`
business key), `Inspection` (UUID PK). `status` stays a string in code (workflow state). The API
speaks in codes; ids never leave the backend.

```
Severity     id PK · code UNIQUE (CRITICAL|MAJOR|MINOR) · label · rank UNIQUE (0=most severe)
DefectType   id PK · code UNIQUE · label · isActive DEFAULT 1 · sortOrder DEFAULT 0
             sapCode STRING NULL UNIQUE            -- maps a SAP defect code → this type (mapping as data)
Inspection   id UUID PK (client may supply — see §5)
             inspectionDate DATEONLY (YYYY-MM-DD; Zod regex + real-date refine at the edge) · machineId STRING
             defectTypeId FK · severityId FK
             remarks STRING?
             status STRING DEFAULT 'OPEN' (OPEN|RESOLVED)
             resolutionNote STRING? · resolvedAt DATE?
             source STRING DEFAULT 'MANUAL' (MANUAL|SAP)   -- provenance
             externalRef STRING? UNIQUE                    -- SAP event id / idempotency key
             clientCreatedAt DATE?                          -- device capture time (offline accuracy)
             createdAt · updatedAt
             indexes: (status)(severityId)(defectTypeId)(inspectionDate)(createdAt)(updatedAt)
```

**Associations:** `Inspection.belongsTo(DefectType|Severity)`; `DefectType|Severity.hasMany(Inspection)`.

### 3.1 Inbound event log (for the SAP integration)
```
WebhookEvent  id UUID PK
              eventId STRING UNIQUE          -- SAP's event id → idempotency
              source STRING ('SAP')
              payload TEXT                    -- raw body, for audit / replay
              status STRING (RECEIVED|PROCESSED|FAILED)  ·  deliveryCount INTEGER DEFAULT 1
              error TEXT? · inspectionId UUID? FK → Inspection
              receivedAt · processedAt?
```
This makes the webhook **persist-then-process**: every event is durably logged before we act, so
failures become a **dead-letter** (status FAILED) that's inspectable and replayable — not a lost
message. Only signature-valid events are persisted (rejected 401s are application-logged only, so
unauthenticated callers can't write to the table); a duplicate delivery bumps `deliveryCount`
instead of adding a row.

### 3.2 Invariants (service layer)
New inspections OPEN with null note/resolvedAt; resolve **once** (409); resolve **requires** a
non-empty note (400); `resolvedAt`, `source`, `createdAt` are server-set. Zod validates shape +
codes at the edge; FKs and the unique `externalRef` are the DB-level integrity backstops.

### 3.3 Client-side stores (IndexedDB — not server schema)
`inspections` (read mirror for offline), `reference` (defect types/severities), `outbox`
(pending mutations + dead-letter). Detailed in §5.2.

---

## 4. API Design

- Base `/api` · Envelope: success `{ data, meta? }`, error `{ error: { code, message, details? } }`.
- **`error.code` closed set:** `VALIDATION_ERROR` (400) · `NOT_FOUND` (404) · `ALREADY_RESOLVED` (409) · `INVALID_SIGNATURE` (401) · `INTERNAL_ERROR` (500). The client branches on these.

| Method | Path | Purpose | Success | Errors |
|---|---|---|---|---|
| GET | `/api/health` | Liveness | 200 | — |
| GET | `/api/severities` · `/api/defect-types` | Dropdown options | 200 | — |
| POST | `/api/inspections` | Create; **idempotent on client `id`** | 201 new / **200 existing** | 400 |
| GET | `/api/inspections` | List (filter+sort+paginate) + **`updatedSince` delta pull** | 200 + meta | 400 |
| GET | `/api/inspections/:id` | Single | 200 | 404 |
| PATCH | `/api/inspections/:id/resolve` | Resolve w/ mandatory note | 200 | 400,404,409 |
| GET | `/api/inspections/summary` | Counts by status × severity | 200 | — |
| POST | `/api/sap-webhook` | Signed, idempotent SAP ingest (§5.1) | 201 / 200 dup | 400,401,500 |
| POST | `/api/auth/login` *(optional)* | Issue JWT | 200 | 401 |

**Idempotent create:** the client `id` is **optional** (server `UUIDv4` fallback); the offline
client always supplies one, so idempotency holds where it matters without forcing manual/SAP
callers to mint UUIDs. If the `id` already exists, return **200** with the stored record instead of
201. A same-`id` request with a *divergent body* is treated as a no-op (return the stored record)
and logged — a client mints an id per inspection and never reuses it, so a true divergence is a
client bug, not a normal path (chosen over 409-on-mismatch to keep offline replay bulletproof).
**Delta pull:** `GET /api/inspections?updatedSince=<ISO>` returns rows changed since the cursor,
so the client refreshes its mirror without a full refetch.

---

## 5. Integration & Offline Architecture

**One principle, applied twice.** SAP ingestion and offline sync are both **at-least-once**
pipelines, so both rest on **idempotent writes** keyed by an idempotency token: SAP → `externalRef`
(event id), offline → the client-generated `Inspection.id`. Retries are safe by construction.

### 5.1 SAP webhook — signed, persist-then-process, idempotent

**Trust:** SAP signs the request with a shared secret and sends
`X-QIT-Signature: sha256=<hmac>` + `X-QIT-Timestamp`. HMAC-SHA256 is computed over
**`${timestamp}.${rawBody}`** — the timestamp is inside the signed string, so rewriting the header
invalidates the signature and the replay window is actually enforced. (Signing the body alone
would leave the timestamp attacker-controlled, voiding the very control it exists for.) The raw
bytes are captured via a `rawBody` middleware on this route — re-serialized JSON wouldn't match —
then **constant-time compare** → 401 on mismatch, and stale timestamps are rejected.
Rejected (401) requests are application-logged only — never persisted, so unauthenticated traffic
can't write to the event table.

**Idempotency:** `eventId` is stored UNIQUE in `WebhookEvent`; a repeat returns the prior outcome.
The created `Inspection.externalRef = eventId` is the second guard.

**Flow**
1. Verify signature + timestamp → **401** (app-logged only, never persisted).
2. Zod-validate structure → **400** (malformed = SAP bug; safe to reject).
3. Look up `WebhookEvent` by `eventId` and **branch on stored status**:
   - **PROCESSED** ⇒ bump `deliveryCount`, return the stored result, **200** (idempotent).
   - **RECEIVED / FAILED** (a prior attempt crashed or failed) ⇒ bump `deliveryCount` and re-attempt
     processing — so SAP's retry stays meaningful and the dead-letter **self-heals**.
   - **absent** ⇒ persist a new `WebhookEvent` (RECEIVED, raw payload), then process. (The `eventId`
     UNIQUE constraint arbitrates two concurrent first deliveries: the loser catches the violation
     and treats it as a duplicate.)
4. Map SAP → domain; resolve defect via `DefectType.sapCode` (unknown ⇒ `OTHER`, keep raw code in
   remarks). **In one transaction:** create `Inspection` (source=SAP, externalRef=eventId) + mark the
   event `PROCESSED` (link `inspectionId`) — atomic, so a crash rolls back both and leaves no orphan.
5. Return **201** on first success, **200** if already `PROCESSED`.
6. Processing error ⇒ event `FAILED` (dead-letter), **500** so SAP retries; the retry re-enters at
   step 3 and re-attempts.

**Mapping as data:** `DefectType.sapCode` keeps the SAP↔our-code map in the reference table — edit
without a deploy. **Scale note:** synchronous create is right-sized here; the event log lets us
evolve to accept→**202**→queue→worker with no contract change.

| Failure | Response | Handling |
|---|---|---|
| Bad/absent signature | 401 | App log only; no DB row |
| Malformed payload | 400 | Logged (SAP bug); safe to reject |
| Duplicate event | 200 | Return prior result; bump `deliveryCount`; no new row |
| Unknown defect code | 201 | Map → OTHER, preserve raw code |
| DB error mid-process | 500 | Event FAILED (dead-letter); SAP retry re-attempts (self-heals) |

### 5.2 Offline-first — service worker + outbox + sync saga

**Three layers.**
1. **Service Worker** (`vite-plugin-pwa` / Workbox) — precache the app shell + assets so it loads
   with no network; runtime-cache reference-data GETs (stale-while-revalidate).
2. **IndexedDB** (Dexie) — `inspections` mirror, `reference`, and the **`outbox`** (+ dead-letter).
3. **Sync engine (Redux Saga)** — drains the outbox and reconciles. *This is why saga is here.*

**Write path (optimistic + outbox).** A create/resolve updates local state immediately and appends
a persisted op `{ opId, type: CREATE|RESOLVE, inspectionId(uuid), payload, attempts }`. Unsynced
records show a **pending** badge.

**Read path.** List/summary render from the IndexedDB mirror offline. On reconnect, a **delta pull**
(`updatedSince`) merges only changed rows.

**Sync engine (saga).** Watches `online` + a manual "sync now"; `takeLeading` ⇒ single-flight (no
double drain). FIFO-drains the outbox:
- **Create** → `POST /inspections` w/ client id → 201, or **200 (exists) ⇒ idempotent** ⇒ dequeue.
- **Resolve** → `PATCH /:id/resolve` → 200, or **409 (already resolved) ⇒ treat as success**, reconcile.
- **Network error** → keep queued, exponential backoff, retry next online.
- **400 validation** → move to local **dead-letter**, surface to user (can't auto-fix).
- **Ordering:** same-inspection ops stay FIFO, so CREATE always precedes its RESOLVE (shared id).

**Conflict policy.** Creates are conflict-free (unique client UUID). Resolves are **server-wins**,
arbitrated by resolve-once — a 409 means "server already resolved it," which we accept. The domain
is low-conflict by design, so no field-level merge is needed.

| Failure | Handling |
|---|---|
| Flaky network mid-sync | Op stays queued; backoff retry |
| Server 409 on resolve | Accept server state; dequeue |
| Server 400 on a queued op | Dead-letter; user must fix |
| Create id already exists | 200 idempotent; dequeue |
| App closed | Resume on next open (Background Sync if supported — enhancement) |
| IndexedDB unavailable | Degrade to online-only with a warning |

### 5.3 Why Saga earns its keep
The sync engine is saga's sweet spot: a long-lived watcher doing a **single-flight** (`takeLeading`)
outbox drain with **retry/backoff** and reconciliation. *Say:* "I chose saga partly for this — the
sync engine is declarative in saga and messy with thunks."

---

## 6. Frontend Design (mobile-first, 390px)

Bottom tab bar (`List` · `Summary`) + floating **＋ Log**. Screens: List (cards + filter/sort),
Log (form; dropdowns from the API), Resolve (modal; submit disabled until note non-empty), Summary
(Open/Resolved totals + severity mini-table). Data flow is the saga loop; reference data loads once
on app start. Offline: pending badges on unsynced records; a subtle offline/queued indicator.

---

## 7. Implementation Plan (72 hours)

Front-load a working vertical slice, then widen. Small, labelled commits.

### Phase 0 — Setup from an empty folder (≈2h)
`git init` + `.gitignore`; monorepo; init `api` (Express + Sequelize + sqlite3, `.sequelizerc`,
config, migrations/seeders, `/api/health`) and `web` (Vite + RTK + saga + Tailwind v4). Done when
health returns ok and the page renders. First commit `chore: project setup` closes the phase.

| Phase | Deliverable |
|---|---|
| **1 — Vertical slice** (≈6h) | Models + migrations + **two seeders** (reference data = required; demo inspections = optional); reference + inspections endpoints (idempotent create); store + inspections/reference slices/sagas; List + Log through the saga loop |
| **2 — Resolve + Summary** (≈4h) | Resolve endpoint + invariants; summary; Resolve modal + Summary screen |
| **3 — Filter/sort + hardening** (≈4h) | List query params + filter bar; central error middleware + status codes |
| **4 — Mobile polish + README** (≈4h) | 390px pass, badges, empty/loading/error; README + trade-offs |
| **5 — SAP integration** (≈5h) | add `dotenv` + `.env` (shared secret); `WebhookEvent` + `source`/`externalRef` + `sapCode` migration; rawBody + HMAC verify; persist-then-process ingest; tests (dup event, bad signature) |
| **6 — Offline** (≈7h) | vite-plugin-pwa SW; Dexie stores; outbox + optimistic writes; sync saga (drain/backoff/dead-letter); delta pull; pending badges |
| **7 — QA & submit** (≈2h) | Docker Compose (api + nginx-served web, named volume, migrate/seed on start); fresh-clone run of both paths; commit hygiene; push public repo |

**Backend build order:** db → models → migrations → seeders → app → zod → reference endpoints →
create(idempotent) → list(+delta) → get → resolve → summary → error middleware → sap ingest.

**Right-sizing (honest cut lines).** Offline is the single biggest lift. If time runs short, the
**MVP-offline** slice is: SW app-shell caching + outbox for create/resolve + online-triggered sync
with idempotent replay. Documented-as-future: Background Sync, delta pull, and the dead-letter UI.
Ship the slice that runs cleanly over a half-wired full version.

### 7.0 Testing
**Vitest + supertest** for the API (hit the Express app directly); **Vitest** for web
reducers/sagas. Tests run against a file-based **`data/test.sqlite`** — not `:memory:`, because
`sequelize-cli` migrates in a separate process and can't share an in-memory connection. A `pretest`
step drops → migrates → **`db:seed:all`** — the same one command a human runs, no test-only seeder
branching. **Isolation lives in the harness, not the seeder:** each API test file truncates the
**mutable** tables in `beforeEach` (`inspections`; from Phase 5 also `webhook_events`, cleared
FK-safe) while the lookup tables survive, and Vitest runs with **`fileParallelism: false`** (one
SQLite file can't take parallel writers). The file is gitignored. Tests are written **before** the
implementation, per phase.

### 7.1 Deliberately NOT doing (README)
No users/roles in base app; no machine master table; no shared types package (duplicated `types.ts`).

### 7.2 With more time
Shared types/validation package; reference-data admin UI; SAP→202→queue→worker at scale;
Background Sync + richer conflict UI; e2e tests + RBAC.
