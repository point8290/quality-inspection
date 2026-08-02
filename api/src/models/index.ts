import { DefectType } from './defectType';
import { Inspection } from './inspection';
import { Severity } from './severity';

// Associations live in one file so the whole object graph is readable in one place, and so
// importing a single model can't leave the relations half-registered.
Inspection.belongsTo(DefectType, { foreignKey: 'defectTypeId', as: 'defectType' });
Inspection.belongsTo(Severity, { foreignKey: 'severityId', as: 'severity' });

DefectType.hasMany(Inspection, { foreignKey: 'defectTypeId' });
Severity.hasMany(Inspection, { foreignKey: 'severityId' });

export { DefectType, Inspection, Severity };
export { INSPECTION_STATUS } from './inspection';
