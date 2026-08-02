import { sequelize } from '../../src/db';
import { Inspection } from '../../src/models';

/**
 * Isolation lives in the harness, not the seeders (DESIGN.md §7.0). `pretest` runs the same
 * `db:seed:all` a human runs, then every test file wipes only the *mutable* tables between
 * tests — the seeded lookup tables (severities, defect_types) survive, so tests can rely on
 * CRITICAL/HOLE/etc. existing.
 *
 * SQLite has no TRUNCATE. From Phase 5 this list grows to delete webhook_events first, since
 * it holds a foreign key to inspections.
 */
export async function resetMutableTables() {
  await sequelize.query('DELETE FROM inspections');
}

/**
 * Rewrites createdAt so ordering and pagination tests aren't at the mercy of clock ties —
 * three HTTP round-trips can easily land in the same millisecond.
 *
 * Goes through the model rather than raw SQL so Sequelize writes the date in the format its
 * SQLite dialect reads back. `silent: true` stops updatedAt from being bumped.
 */
export async function backdate(id: string, createdAt: Date) {
  await Inspection.update({ createdAt }, { where: { id }, silent: true });
}

export async function closeDb() {
  await sequelize.close();
}
