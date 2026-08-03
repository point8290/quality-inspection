import cors from 'cors';
import express from 'express';
import { errorHandler } from './middleware/error';
import { inspectionsRouter } from './routes/inspections';
import { referenceDataRouter } from './routes/referenceData';
import { sapRouter } from './routes/sap';

export const app = express();

// The web app calls through Vite's dev proxy (same origin), but cors() keeps the API
// usable when the two are served from different origins — e.g. docker compose.
app.use(cors());

// ─────────────────────────────────────────────────────────────────────────────
// ORDER MATTERS. The SAP webhook is mounted ABOVE express.json() so it receives the raw
// bytes: SAP signs the body it sent, and a JSON round-trip through express.json() would
// re-serialise it into something that no longer byte-matches the signature. Moving this
// below express.json() breaks signature verification silently — every delivery 401s.
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/sap-webhook', express.raw({ type: '*/*', limit: '256kb' }), sapRouter);

app.use(express.json());

// Liveness. Uses the same { data } success envelope as every other endpoint (DESIGN.md §4).
app.get('/api/health', (_req, res) => {
  res.json({ data: { status: 'ok' } });
});

app.use('/api', referenceDataRouter);
app.use('/api/inspections', inspectionsRouter);

// Unknown paths get the same error envelope as everything else, not Express's HTML page.
app.use((req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
});

// Registered last: Express only treats a four-argument function as an error handler, and
// only sees errors raised by middleware mounted above it.
app.use(errorHandler);

// app is exported without listening so tests can drive it in-process with supertest;
// src/index.ts owns the port.
