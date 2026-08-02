'use strict';

const { randomUUID } = require('node:crypto');

// Optional demo data so a fresh clone shows a populated list instead of an empty state.
// Tests wipe this table in beforeEach, so these rows never affect assertions (DESIGN.md §7.0).

const DEMO_ROWS = [
  { day: '2026-07-28', machineId: 'LOOM-01', defect: 'HOLE', severity: 'CRITICAL', remarks: 'Warp break, 3 m run damaged' },
  { day: '2026-07-28', machineId: 'LOOM-03', defect: 'STAIN', severity: 'MINOR', remarks: 'Oil spot near selvedge' },
  { day: '2026-07-29', machineId: 'LOOM-01', defect: 'WEAVING_DEFECT', severity: 'MAJOR', remarks: null },
  { day: '2026-07-29', machineId: 'DYE-02', defect: 'COLOR_VARIATION', severity: 'MAJOR', remarks: 'Shade off vs approved swatch' },
  { day: '2026-07-30', machineId: 'LOOM-05', defect: 'HOLE', severity: 'MINOR', remarks: null },
  { day: '2026-07-30', machineId: 'DYE-02', defect: 'SHRINKAGE', severity: 'CRITICAL', remarks: 'Beyond tolerance after wash test' },
  { day: '2026-07-31', machineId: 'LOOM-03', defect: 'STAIN', severity: 'MAJOR', remarks: 'Recurring on the same shift' },
  { day: '2026-08-01', machineId: 'LOOM-04', defect: 'WEAVING_DEFECT', severity: 'MINOR', remarks: null },
];

/** Reads the surrogate ids back by business code, rather than assuming autoincrement values. */
async function lookupIds(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(`SELECT id, code FROM ${table}`);
  return Object.fromEntries(rows.map((row) => [row.code, row.id]));
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const defectTypeIds = await lookupIds(queryInterface, 'defect_types');
    const severityIds = await lookupIds(queryInterface, 'severities');
    const now = new Date();

    await queryInterface.bulkInsert(
      'inspections',
      DEMO_ROWS.map((row, index) => ({
        id: randomUUID(),
        inspectionDate: row.day,
        machineId: row.machineId,
        defectTypeId: defectTypeIds[row.defect],
        severityId: severityIds[row.severity],
        remarks: row.remarks,
        status: 'OPEN',
        resolutionNote: null,
        resolvedAt: null,
        // Spread createdAt so the default "newest first" list has a stable, readable order.
        createdAt: new Date(now.getTime() + index * 1000),
        updatedAt: new Date(now.getTime() + index * 1000),
      })),
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('inspections', null, {});
  },
};
