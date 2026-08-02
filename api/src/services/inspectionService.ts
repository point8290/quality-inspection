import { UniqueConstraintError } from 'sequelize';
import { ErrorDetail, notFoundError, validationError } from '../lib/errors';
import { DefectType, Inspection, Severity } from '../models';
import { CreateInspectionInput, ListInspectionsQuery } from '../schemas/inspection';

// Every read includes both relations, because the serializer turns them into codes.
const WITH_RELATIONS = [
  { model: DefectType, as: 'defectType' },
  { model: Severity, as: 'severity' },
];

/**
 * The API writes by business code, so the codes have to become surrogate ids somewhere —
 * here. An unknown code is a bad field value in the request, so it's a 400 shaped exactly
 * like a Zod failure; Zod can't check it itself without hitting the database.
 */
async function resolveReferenceIds(defectTypeCode: string, severityCode: string) {
  const [defectType, severity] = await Promise.all([
    DefectType.findOne({ where: { code: defectTypeCode } }),
    Severity.findOne({ where: { code: severityCode } }),
  ]);

  if (!defectType || !severity) {
    const details: ErrorDetail[] = [];
    if (!defectType) {
      details.push({
        path: 'defectTypeCode',
        message: `Unknown defect type code "${defectTypeCode}"`,
      });
    }
    if (!severity) {
      details.push({ path: 'severityCode', message: `Unknown severity code "${severityCode}"` });
    }
    throw validationError('Request validation failed', details);
  }

  return { defectTypeId: defectType.id, severityId: severity.id };
}

function findInspection(id: string) {
  return Inspection.findByPk(id, { include: WITH_RELATIONS });
}

/**
 * Idempotent on the client-supplied id (DESIGN.md §4): a replayed create returns the stored
 * row instead of writing a second one, which is what makes the offline outbox safe to drain
 * more than once. A divergent body on a known id is deliberately a no-op, not a 409.
 */
export async function createInspection(input: CreateInspectionInput) {
  if (input.id) {
    const existing = await findInspection(input.id);
    if (existing) {
      console.warn(`Idempotent create: inspection ${input.id} already exists, returning stored row`);
      return { created: false, inspection: existing };
    }
  }

  const { defectTypeId, severityId } = await resolveReferenceIds(
    input.defectTypeCode,
    input.severityCode,
  );

  try {
    const created = await Inspection.create({
      id: input.id,
      inspectionDate: input.inspectionDate,
      machineId: input.machineId,
      defectTypeId,
      severityId,
      remarks: input.remarks ?? null,
      // status, resolutionNote, resolvedAt and the timestamps are server-owned (§3.2), so
      // they are never taken from the request body.
    });

    const inspection = await findInspection(created.id);
    if (!inspection) {
      throw new Error(`Inspection ${created.id} vanished immediately after being created`);
    }

    return { created: true, inspection };
  } catch (error) {
    // Two replays of the same id arriving at once: the loser reads back the winner's row.
    if (error instanceof UniqueConstraintError && input.id) {
      const existing = await findInspection(input.id);
      if (existing) {
        return { created: false, inspection: existing };
      }
    }
    throw error;
  }
}

export async function getInspection(id: string) {
  const inspection = await findInspection(id);

  if (!inspection) {
    throw notFoundError(`No inspection with id "${id}"`);
  }

  return inspection;
}

export async function listInspections({ page, pageSize }: ListInspectionsQuery) {
  const { rows, count } = await Inspection.findAndCountAll({
    include: WITH_RELATIONS,
    // Newest first is what a supervisor wants on arriving; Phase 3 adds the other sorts.
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return {
    inspections: rows,
    meta: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}
