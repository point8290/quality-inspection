import { QueryTypes } from 'sequelize';
import { sequelize } from '../db';
import { INSPECTION_STATUS, Severity } from '../models';

type StatusCounts = {
  [INSPECTION_STATUS.OPEN]: number;
  [INSPECTION_STATUS.RESOLVED]: number;
};

type GroupedRow = {
  severityCode: string;
  status: string;
  count: number;
};

const emptyCounts = (): StatusCounts => ({ OPEN: 0, RESOLVED: 0 });

/**
 * Open vs Resolved, per severity. Written as one grouped SQL statement rather than reading
 * every row and counting in JavaScript — the database does the aggregation, so the response
 * cost doesn't grow with the size of the table.
 *
 * The shape is built server-side (nested, zero-filled, keyed by code) so the client renders
 * the mini-table by reading fields directly and the "counts sum to the total" invariant is
 * enforced in exactly one place. Trade-off worth naming: the nested shape is coupled to the
 * two statuses, so a third workflow state would mean a server change — acceptable, because
 * status is a closed set by design.
 */
export async function getSummary() {
  const [severities, rows] = await Promise.all([
    Severity.findAll({ order: [['rank', 'ASC']] }),
    sequelize.query<GroupedRow>(
      `SELECT s.code AS severityCode, i.status AS status, COUNT(*) AS count
         FROM inspections i
         JOIN severities s ON s.id = i.severityId
        GROUP BY s.code, i.status`,
      { type: QueryTypes.SELECT },
    ),
  ]);

  // Zero-fill every severity first, so the table never reflows as data arrives and a
  // severity with no inspections still shows a row.
  const bySeverity: Record<string, StatusCounts> = {};
  for (const severity of severities) {
    bySeverity[severity.code] = emptyCounts();
  }

  const byStatus = emptyCounts();
  let total = 0;

  for (const row of rows) {
    const counts = bySeverity[row.severityCode];
    const status = row.status === INSPECTION_STATUS.RESOLVED ? 'RESOLVED' : 'OPEN';

    // A row whose severity is no longer in the lookup table can't be shown in the table,
    // but it must still be counted in the total — otherwise the sums stop adding up.
    if (counts) {
      counts[status] += row.count;
    }

    byStatus[status] += row.count;
    total += row.count;
  }

  return { total, byStatus, bySeverity };
}
