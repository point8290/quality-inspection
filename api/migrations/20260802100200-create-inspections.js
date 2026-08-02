'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inspections', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      inspectionDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      machineId: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      defectTypeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'defect_types', key: 'id' },
      },
      severityId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'severities', key: 'id' },
      },
      remarks: {
        type: Sequelize.STRING(1000),
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'OPEN',
      },
      resolutionNote: {
        type: Sequelize.STRING(1000),
        allowNull: true,
      },
      resolvedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Indexes on every column the list can filter or sort by (DESIGN.md §3).
    await queryInterface.addIndex('inspections', ['status']);
    await queryInterface.addIndex('inspections', ['severityId']);
    await queryInterface.addIndex('inspections', ['defectTypeId']);
    await queryInterface.addIndex('inspections', ['inspectionDate']);
    await queryInterface.addIndex('inspections', ['createdAt']);
    // Powers the offline delta pull: GET /api/inspections?updatedSince=... (DESIGN.md §4).
    await queryInterface.addIndex('inspections', ['updatedAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inspections');
  },
};
