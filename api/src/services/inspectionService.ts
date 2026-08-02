import { Op, Order, UniqueConstraintError, WhereOptions } from 'sequelize';
import { alreadyResolvedError, ErrorDetail, notFoundError, validationError } from '../lib/errors';
import { DefectType, INSPECTION_STATUS, Inspection, Severity } from '../models';
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

/**
 * Both resolve invariants live here, not in the UI (DESIGN.md §3.2): the note is mandatory
 * (enforced by the schema) and an inspection resolves exactly once.
 *
 * The status check and the write are ONE conditional UPDATE rather than a read followed by a
 * save — with a read-then-write, two supervisors tapping at the same moment could both see
 * OPEN and both write. Zero rows affected *is* the conflict signal; the database arbitrates.
 */
export async function resolveInspection(id: string, resolutionNote: string) {
  const [affectedRows] = await Inspection.update(
    {
      status: INSPECTION_STATUS.RESOLVED,
      resolutionNote,
      // Server-set, always — a resolvedAt in the request body is ignored.
      resolvedAt: new Date(),
    },
    { where: { id, status: INSPECTION_STATUS.OPEN } },
  );

  if (affectedRows === 0) {
    // Only on the failure path do we pay for a second read, to say *why* it failed.
    const existing = await findInspection(id);
    if (!existing) {
      throw notFoundError(`No inspection with id "${id}"`);
    }
    throw alreadyResolvedError(`Inspection "${id}" is already resolved`);
  }

  const inspection = await findInspection(id);
  if (!inspection) {
    throw new Error(`Inspection ${id} vanished immediately after being resolved`);
  }

  return inspection;
}

/**
 * Filter codes are validated the same way create validates them: an unknown code is a 400
 * naming the field, not a silently empty list. The client only ever sends codes it got from
 * the reference endpoints, so a code we don't know means the request is wrong.
 */
async function resolveFilterCodes(query: ListInspectionsQuery) {
  const details: ErrorDetail[] = [];
  let severityId: number | undefined;
  let defectTypeId: number | undefined;

  if (query.severityCode) {
    const severity = await Severity.findOne({ where: { code: query.severityCode } });
    if (severity) {
      severityId = severity.id;
    } else {
      details.push({
        path: 'severityCode',
        message: `Unknown severity code "${query.severityCode}"`,
      });
    }
  }

  if (query.defectTypeCode) {
    const defectType = await DefectType.findOne({ where: { code: query.defectTypeCode } });
    if (defectType) {
      defectTypeId = defectType.id;
    } else {
      details.push({
        path: 'defectTypeCode',
        message: `Unknown defect type code "${query.defectTypeCode}"`,
      });
    }
  }

  if (details.length > 0) {
    throw validationError('Request validation failed', details);
  }

  return { severityId, defectTypeId };
}

function buildWhere(
  query: ListInspectionsQuery,
  ids: { severityId?: number; defectTypeId?: number },
): WhereOptions {
  const where: Record<string, unknown> = {};

  if (query.status) {
    where.status = query.status;
  }
  if (ids.severityId !== undefined) {
    where.severityId = ids.severityId;
  }
  if (ids.defectTypeId !== undefined) {
    where.defectTypeId = ids.defectTypeId;
  }

  // inspectionDate is a DATEONLY 'YYYY-MM-DD', so a range is an inclusive string compare —
  // no timezone arithmetic, and the boundary days are part of the range.
  if (query.dateFrom && query.dateTo) {
    where.inspectionDate = { [Op.between]: [query.dateFrom, query.dateTo] };
  } else if (query.dateFrom) {
    where.inspectionDate = { [Op.gte]: query.dateFrom };
  } else if (query.dateTo) {
    where.inspectionDate = { [Op.lte]: query.dateTo };
  }

  // Exclusive (>): a client re-syncing with its last-seen timestamp must not re-pull the
  // very row that produced that timestamp.
  if (query.updatedSince) {
    where.updatedAt = { [Op.gt]: new Date(query.updatedSince) };
  }

  return where;
}

/** Every ordering ends on the primary key, so a page boundary can't drop or repeat a row. */
function buildOrder(query: ListInspectionsQuery): Order {
  if (query.updatedSince) {
    // Sync mode: ascending, so a client pages forward through changes without gaps.
    return [
      ['updatedAt', 'ASC'],
      ['id', 'ASC'],
    ];
  }

  const direction = query.sortDir === 'asc' ? 'ASC' : 'DESC';

  switch (query.sortBy) {
    case 'inspectionDate':
      return [
        ['inspectionDate', direction],
        ['createdAt', 'DESC'],
        ['id', 'ASC'],
      ];
    case 'severity':
      // This is what `rank` exists for: 0 is the most severe, so sortDir keeps exactly the
      // meaning it has on every other column and asc puts CRITICAL first.
      return [
        [{ model: Severity, as: 'severity' }, 'rank', direction],
        ['createdAt', 'DESC'],
        ['id', 'ASC'],
      ];
    default:
      // Newest first is what a supervisor wants on arriving.
      return [
        ['createdAt', direction],
        ['id', 'ASC'],
      ];
  }
}

export async function listInspections(query: ListInspectionsQuery) {
  const ids = await resolveFilterCodes(query);
  const { page, pageSize } = query;

  const { rows, count } = await Inspection.findAndCountAll({
    where: buildWhere(query, ids),
    include: WITH_RELATIONS,
    order: buildOrder(query),
    limit: pageSize,
    offset: (page - 1) * pageSize,
    // Ordering by a column on an included model doesn't survive Sequelize's default
    // "subquery + limit" strategy. Safe to switch off here because both relations are
    // belongsTo, so the join can't multiply rows and the count stays correct.
    subQuery: false,
  });

  return {
    inspections: rows,
    meta: {
      page,
      pageSize,
      // Counts the filtered set, not the table — so meta.total matches what's on screen.
      total: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}
