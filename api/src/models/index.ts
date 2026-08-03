import { DefectType } from './defectType';
import { Inspection } from './inspection';
import { Severity } from './severity';
import { WebhookEvent } from './webhookEvent';

// Associations live in one file so the whole object graph is readable in one place, and so
// importing a single model can't leave the relations half-registered.
Inspection.belongsTo(DefectType, { foreignKey: 'defectTypeId', as: 'defectType' });
Inspection.belongsTo(Severity, { foreignKey: 'severityId', as: 'severity' });

DefectType.hasMany(Inspection, { foreignKey: 'defectTypeId' });
Severity.hasMany(Inspection, { foreignKey: 'severityId' });

// The event log points at the inspection it produced, so a dead letter can be traced to its
// outcome (or the absence of one).
WebhookEvent.belongsTo(Inspection, { foreignKey: 'inspectionId', as: 'inspection' });

export { DefectType, Inspection, Severity, WebhookEvent };
export { INSPECTION_SOURCE, INSPECTION_STATUS } from './inspection';
export { WEBHOOK_EVENT_STATUS } from './webhookEvent';
