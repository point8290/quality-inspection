'use strict';

// Required reference data: without it the dropdowns are empty and nothing can be logged.
// The demo inspections are a separate seeder so this one can be run on its own.

const SEVERITIES = [
  { code: 'CRITICAL', label: 'Critical', rank: 0 },
  { code: 'MAJOR', label: 'Major', rank: 1 },
  { code: 'MINOR', label: 'Minor', rank: 2 },
];

const DEFECT_TYPES = [
  { code: 'HOLE', label: 'Hole / Tear', isActive: true, sortOrder: 10 },
  { code: 'STAIN', label: 'Stain', isActive: true, sortOrder: 20 },
  { code: 'WEAVING_DEFECT', label: 'Weaving Defect', isActive: true, sortOrder: 30 },
  { code: 'COLOR_VARIATION', label: 'Colour Variation', isActive: true, sortOrder: 40 },
  { code: 'SHRINKAGE', label: 'Shrinkage', isActive: true, sortOrder: 50 },
  // Retired code: kept so historical inspections still resolve, hidden from the dropdown.
  { code: 'MISPRINT', label: 'Misprint (retired)', isActive: false, sortOrder: 60 },
  // Fallback for SAP events carrying a defect code we don't recognise (DESIGN.md §5.1).
  { code: 'OTHER', label: 'Other', isActive: true, sortOrder: 99 },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('severities', SEVERITIES);
    await queryInterface.bulkInsert('defect_types', DEFECT_TYPES);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('defect_types', {
      code: { [Sequelize.Op.in]: DEFECT_TYPES.map((row) => row.code) },
    });
    await queryInterface.bulkDelete('severities', {
      code: { [Sequelize.Op.in]: SEVERITIES.map((row) => row.code) },
    });
  },
};
