import { Router } from 'express';
import { asyncRoute } from '../lib/asyncRoute';
import { toDefectTypeDto, toSeverityDto } from '../lib/serialize';
import { listDefectTypes, listSeverities } from '../services/referenceService';

// Routes stay thin: validate, call a service, wrap the result in the envelope.
export const referenceDataRouter = Router();

referenceDataRouter.get(
  '/severities',
  asyncRoute(async (_req, res) => {
    const severities = await listSeverities();
    res.json({ data: severities.map(toSeverityDto) });
  }),
);

referenceDataRouter.get(
  '/defect-types',
  asyncRoute(async (_req, res) => {
    const defectTypes = await listDefectTypes();
    res.json({ data: defectTypes.map(toDefectTypeDto) });
  }),
);
