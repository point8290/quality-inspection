/** A valid POST /api/inspections body; override any field to make it invalid on purpose. */
export function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    inspectionDate: '2026-07-15',
    machineId: 'LOOM-04',
    defectTypeCode: 'HOLE',
    severityCode: 'MAJOR',
    remarks: 'Recurring on the left selvedge',
    ...overrides,
  };
}
