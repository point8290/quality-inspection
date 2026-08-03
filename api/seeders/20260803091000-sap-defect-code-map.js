'use strict';

/**
 * Populates the SAP↔our-code map on the existing defect types.
 *
 * A separate seeder that UPDATEs, rather than an edit to the Phase 1 seeder: editing a
 * seeder that has already run only helps a fresh clone, and leaves every existing database
 * behind. This also puts "mapping as data" on display — adding a SAP code later is a seeder
 * or an admin edit, never a deploy.
 *
 * OTHER deliberately has no sapCode: it's the fallback for codes we don't recognise.
 *
 * @type {import('sequelize-cli').Migration}
 */
const SAP_CODE_MAP = {
  HOLE: 'Q-HOLE-01',
  STAIN: 'Q-STAIN-01',
  WEAVING_DEFECT: 'Q-WEAVE-01',
  COLOR_VARIATION: 'Q-COLOR-01',
  SHRINKAGE: 'Q-SHRINK-01',
};

module.exports = {
  async up(queryInterface) {
    for (const [code, sapCode] of Object.entries(SAP_CODE_MAP)) {
      await queryInterface.bulkUpdate('defect_types', { sapCode }, { code });
    }
  },

  async down(queryInterface) {
    for (const code of Object.keys(SAP_CODE_MAP)) {
      await queryInterface.bulkUpdate('defect_types', { sapCode: null }, { code });
    }
  },
};
