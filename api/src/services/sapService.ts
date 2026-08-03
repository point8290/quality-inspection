import { UniqueConstraintError } from 'sequelize';
import { sequelize } from '../db';
import { AppError, validationError } from '../lib/errors';
import {
  DefectType,
  INSPECTION_SOURCE,
  Inspection,
  Severity,
  WEBHOOK_EVENT_STATUS,
  WebhookEvent,
} from '../models';
import { SapWebhookPayload } from '../schemas/sap';

/** The code every unrecognised SAP defect falls back to. */
const FALLBACK_DEFECT_CODE = 'OTHER';

async function findInspectionWithRelations(id: string) {
  return Inspection.findByPk(id, {
    include: [
      { model: DefectType, as: 'defectType' },
      { model: Severity, as: 'severity' },
    ],
  });
}

/**
 * Severity is a closed three-value contract, so an unknown code is a 400 — a "fix your
 * integration" signal that a well-behaved sender won't retry, rather than a guess that would
 * silently corrupt the summary dashboard.
 */
async function resolveSeverity(severityCode: string) {
  const severity = await Severity.findOne({ where: { code: severityCode } });

  if (!severity) {
    throw validationError('Request validation failed', [
      { path: 'notification.severityCode', message: `Unknown severity code "${severityCode}"` },
    ]);
  }

  return severity;
}

/**
 * The opposite policy to severity, and deliberately so: SAP's defect catalogue is large and
 * changes without telling us. Rejecting an unrecognised code would strand a legitimate event
 * and make SAP retry a payload we will never accept — so it maps to OTHER and the raw code is
 * preserved in the remarks. Nothing is lost, and the mapping itself lives in the reference
 * table, editable without a deploy.
 */
async function mapDefectType(payload: SapWebhookPayload) {
  const { defectCode, description } = payload.notification;
  const matched = await DefectType.findOne({ where: { sapCode: defectCode } });

  if (matched) {
    return { defectType: matched, remarks: description ?? null };
  }

  const fallback = await DefectType.findOne({ where: { code: FALLBACK_DEFECT_CODE } });
  if (!fallback) {
    throw new Error(`Reference data is missing the "${FALLBACK_DEFECT_CODE}" defect type`);
  }

  const preserved = `[SAP defectCode=${defectCode}]`;
  return {
    defectType: fallback,
    remarks: description ? `${preserved} ${description}` : preserved,
  };
}

/**
 * Creates the inspection and marks the event PROCESSED in ONE transaction, so a crash
 * between them rolls back both — a re-attempt can never find an orphaned inspection.
 * Any failure leaves the event as a FAILED dead letter and rethrows, which becomes a 500 so
 * SAP retries into the self-healing branch above.
 */
async function processEvent(event: WebhookEvent, payload: SapWebhookPayload) {
  try {
    const severity = await resolveSeverity(payload.notification.severityCode);
    const { defectType, remarks } = await mapDefectType(payload);

    const inspectionId = await sequelize.transaction(async (transaction) => {
      const inspection = await Inspection.create(
        {
          inspectionDate: payload.notification.inspectionDate,
          machineId: payload.notification.workCenter,
          defectTypeId: defectType.id,
          severityId: severity.id,
          remarks,
          source: INSPECTION_SOURCE.SAP,
          // The second idempotency guard: unique in the database, so even a logic bug
          // cannot produce two inspections for one SAP event.
          externalRef: payload.eventId,
        },
        { transaction },
      );

      await event.update(
        {
          status: WEBHOOK_EVENT_STATUS.PROCESSED,
          inspectionId: inspection.id,
          processedAt: new Date(),
          error: null,
        },
        { transaction },
      );

      return inspection.id;
    });

    const inspection = await findInspectionWithRelations(inspectionId);
    if (!inspection) {
      throw new Error(`Inspection ${inspectionId} vanished immediately after being created`);
    }

    return { created: true, inspection };
  } catch (error) {
    // A validation failure is the sender's fault, not ours — it isn't a dead letter, and
    // retrying it would never succeed.
    if (error instanceof AppError) {
      throw error;
    }

    await event.update({
      status: WEBHOOK_EVENT_STATUS.FAILED,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Persist-then-process, idempotent on `eventId` (DESIGN.md §5.1).
 *
 * The branch on stored status is what makes SAP's retry meaningful: only a PROCESSED event
 * short-circuits. A previous attempt that failed or died midway is re-attempted, so the dead
 * letter heals itself instead of the retry being answered "all good" while nothing exists.
 */
export async function ingestSapEvent(payload: SapWebhookPayload, rawBody: string) {
  // Validated before anything is written, so a bad payload leaves no event row behind.
  await resolveSeverity(payload.notification.severityCode);

  const existing = await WebhookEvent.findOne({ where: { eventId: payload.eventId } });

  if (existing) {
    return redeliver(existing, payload);
  }

  try {
    const event = await WebhookEvent.create({
      eventId: payload.eventId,
      source: 'SAP',
      payload: rawBody,
      status: WEBHOOK_EVENT_STATUS.RECEIVED,
    });

    return await processEvent(event, payload);
  } catch (error) {
    // Two first deliveries raced. The unique eventId is the arbiter: the loser reads back
    // the winner's event and treats its own delivery as a duplicate.
    if (error instanceof UniqueConstraintError) {
      const winner = await WebhookEvent.findOne({ where: { eventId: payload.eventId } });
      if (winner) {
        return redeliver(winner, payload);
      }
    }

    throw error;
  }
}

async function redeliver(event: WebhookEvent, payload: SapWebhookPayload) {
  // A duplicate bumps the counter rather than adding a row, so "SAP retried three times" is
  // visible in the log.
  await event.increment('deliveryCount');
  await event.reload();

  if (event.status === WEBHOOK_EVENT_STATUS.PROCESSED && event.inspectionId) {
    const inspection = await findInspectionWithRelations(event.inspectionId);
    if (inspection) {
      return { created: false, inspection };
    }
  }

  // RECEIVED (a previous attempt crashed) or FAILED (dead letter) — re-attempt.
  return processEvent(event, payload);
}
