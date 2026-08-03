import { Router } from 'express';
import { asyncRoute } from '../lib/asyncRoute';
import { validationError } from '../lib/errors';
import { toInspectionDto } from '../lib/serialize';
import { parseOrThrow } from '../lib/validate';
import { verifySapSignature } from '../middleware/verifySapSignature';
import { sapWebhookSchema } from '../schemas/sap';
import { ingestSapEvent } from '../services/sapService';

export const sapRouter = Router();

sapRouter.post(
  '/',
  // Trust first: nothing below this line runs for an unverified delivery.
  verifySapSignature,
  asyncRoute(async (req, res) => {
    // req.body is the raw Buffer from express.raw(), because the signature covers the exact
    // bytes SAP sent. That means parsing the JSON is ours to do — and to reject.
    const rawBody = (Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)).toString('utf8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw validationError('Request body is not valid JSON', [
        { path: '(body)', message: 'Expected a JSON object' },
      ]);
    }

    const payload = parseOrThrow(sapWebhookSchema, parsed);
    const { created, inspection } = await ingestSapEvent(payload, rawBody);

    // 201 for a genuinely new inspection, 200 when a redelivery found the existing one.
    res.status(created ? 201 : 200).json({ data: toInspectionDto(inspection) });
  }),
);
