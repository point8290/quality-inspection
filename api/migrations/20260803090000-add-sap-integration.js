'use strict';

/**
 * Additive migration for the SAP integration (DESIGN.md §5.1). The core tables from Phase 1
 * are untouched — provenance columns are added, and the inbound event log is created.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Provenance: where did this inspection come from, and what external event produced it.
    await queryInterface.addColumn('inspections', 'source', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'MANUAL',
    });

    // The SAP event id: the database-level backstop for idempotent ingest. Even if the
    // application logic were wrong, a repeated event physically cannot create a second row.
    //
    // The uniqueness is a separate index rather than a UNIQUE column because SQLite cannot
    // ADD COLUMN with a UNIQUE constraint. That's not a workaround — a UNIQUE column is
    // implemented as a unique index anyway, and this spelling gives us the semantics we
    // actually want: unique where not null, so every MANUAL inspection can leave it null.
    await queryInterface.addColumn('inspections', 'externalRef', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addIndex('inspections', ['externalRef'], { unique: true });

    // Mapping as data: the SAP↔our-code map lives in the reference table, so it can be
    // edited without a deploy.
    await queryInterface.addColumn('defect_types', 'sapCode', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addIndex('defect_types', ['sapCode'], { unique: true });

    await queryInterface.createTable('webhook_events', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      // UNIQUE: the idempotency key, and the arbiter when two first deliveries race.
      eventId: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      source: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'SAP',
      },
      // The raw body, kept for audit and replay.
      payload: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'RECEIVED',
      },
      // How many times SAP has delivered this event; a duplicate bumps this instead of
      // adding a row.
      deliveryCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      inspectionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'inspections', key: 'id' },
      },
      receivedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      processedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Finding the dead letters is the point of the table.
    await queryInterface.addIndex('webhook_events', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('webhook_events');
    await queryInterface.removeColumn('defect_types', 'sapCode');
    await queryInterface.removeColumn('inspections', 'externalRef');
    await queryInterface.removeColumn('inspections', 'source');
  },
};
