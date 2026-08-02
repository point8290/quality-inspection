import { DefectType, Severity } from '../models';

/** Most severe first — rank 0 is CRITICAL, so a plain ascending sort is the priority order. */
export function listSeverities() {
  return Severity.findAll({ order: [['rank', 'ASC']] });
}

/** Only active types reach a dropdown; retired codes stay in the table for old inspections. */
export function listDefectTypes() {
  return DefectType.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC']],
  });
}
