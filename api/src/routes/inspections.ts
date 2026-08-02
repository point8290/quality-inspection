import { Router } from 'express';
import { asyncRoute } from '../lib/asyncRoute';
import { toInspectionDto } from '../lib/serialize';
import { parseOrThrow } from '../lib/validate';
import {
  createInspectionSchema,
  inspectionIdParamSchema,
  listInspectionsQuerySchema,
} from '../schemas/inspection';
import { createInspection, getInspection, listInspections } from '../services/inspectionService';

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

// Phase 2 note: GET /summary must be registered ABOVE this route, or ':id' will swallow the
// literal path "summary" and reject it as a malformed UUID.
inspectionsRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    const { id } = parseOrThrow(inspectionIdParamSchema, req.params);
    const inspection = await getInspection(id);

    res.json({ data: toInspectionDto(inspection) });
  }),
);
