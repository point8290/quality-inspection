# Quality Inspection Tracker

Mobile-first web app for shop-floor supervisors to log, track, and resolve fabric quality
defects from a phone.

- **Design & architecture:** [DESIGN.md](DESIGN.md)
- **Decision log / walkthrough:** [WALKTHROUGH.md](WALKTHROUGH.md)

## Stack

React + Vite + TypeScript + Tailwind v4 (Redux Toolkit + Redux Saga) talking to an
Express + TypeScript REST API over Sequelize + SQLite.

## Running locally

Two independent npm projects — install each once.

```bash
# API  → http://localhost:4000
cd api
npm install
npm run migrate && npm run seed
npm run dev

# Web  → http://localhost:5173 (proxies /api to the API)
cd web
npm install
npm run dev
```

Health check: <http://localhost:4000/api/health> returns `{ "data": { "status": "ok" } }`.

## Tests

```bash
cd api && npm test
```

`pretest` drops, migrates, and seeds `api/data/test.sqlite` before the suite runs.

---

*Setup, architecture decisions, and "what I'd do differently with more time" are expanded in
Phase 4 — see [DESIGN.md](DESIGN.md) §7 for the build plan.*
