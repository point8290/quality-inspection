import { DefectType, Inspection, Severity } from '../models';

/**
 * The single place a database row becomes an API payload. Everything the API returns goes
 * through here, which is what guarantees the promise in DESIGN.md §3: the API speaks in
 * codes and surrogate ids never leave the backend.
 */

export function toSeverityDto(severity: Severity) {
  return {
    code: severity.code,
    label: severity.label,
    rank: severity.rank,
  };
}

export function toDefectTypeDto(defectType: DefectType) {
  return {
    code: defectType.code,
    label: defectType.label,
  };
}

export function toInspectionDto(inspection: Inspection) {
  if (!inspection.defectType || !inspection.severity) {
    // A programming error, not a user error: every read path must `include` both relations.
    throw new Error('toInspectionDto requires the defectType and severity relations');
  }

  return {
    id: inspection.id,
    inspectionDate: inspection.inspectionDate,
    machineId: inspection.machineId,
    defectType: toDefectTypeDto(inspection.defectType),
    severity: toSeverityDto(inspection.severity),
    remarks: inspection.remarks,
    status: inspection.status,
    // Provenance, so the UI can show where an inspection came from. The SAP event id itself
    // stays internal — it's an integration detail, not something a supervisor needs.
    source: inspection.source,
    resolutionNote: inspection.resolutionNote,
    resolvedAt: inspection.resolvedAt ? inspection.resolvedAt.toISOString() : null,
    createdAt: inspection.createdAt.toISOString(),
    updatedAt: inspection.updatedAt.toISOString(),
  };
}
