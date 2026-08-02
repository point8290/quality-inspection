import { Router } from 'express';
import { asyncRoute } from '../lib/asyncRoute';
import { toInspectionDto } from '../lib/serialize';
import { parseOrThrow } from '../lib/validate';
import {
  createInspectionSchema,
  inspectionIdParamSchema,
  listInspectionsQuerySchema,
  resolveInspectionSchema,
} from '../schemas/inspection';
import {
  createInspection,
  getInspection,
  listInspections,
  resolveInspection,
} from '../services/inspectionService';
import { getSummary } from '../services/summaryService';

export const inspectionsRouter = Router();

inspectionsRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const input = parseOrThrow(createInspectionSchema, req.body);
    const { created, inspection } = await createInspection(input);

    // 201 for a genuinely new row, 200 when an idempotent replay found the existing one.
    res.status(created ? 201 : 200).json({ data: toInspectionDto(inspection) });
  }),
);

inspectionsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const query = parseOrThrow(listInspectionsQuerySchema, req.query);
    const { inspections, meta } = await listInspections(query);

    res.json({ data: inspections.map(toInspectionDto), meta });
  }),
);

// MUST stay above '/:id': Express matches in registration order, so the param route would
// otherwise swallow the literal path "summary" and reject it as a malformed UUID.
inspectionsRouter.get(
  '/summary',
  asyncRoute(async (_req, res) => {
    const summary = await getSummary();
    res.json({ data: summary });
  }),
);

inspectionsRouter.patch(
  '/:id/resolve',
  asyncRoute(async (req, res) => {
    const { id } = parseOrThrow(inspectionIdParamSchema, req.params);
    const { resolutionNote } = parseOrThrow(resolveInspectionSchema, req.body);
    const inspection = await resolveInspection(id, resolutionNote);

    res.json({ data: toInspectionDto(inspection) });
  }),
);

inspectionsRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const { id } = parseOrThrow(inspectionIdParamSchema, req.params);
    const inspection = await getInspection(id);

    res.json({ data: toInspectionDto(inspection) });
  }),
);
