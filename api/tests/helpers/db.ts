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

/** The literal format Sequelize's SQLite dialect writes and reads: '2026-07-10 12:00:00.000 +00:00'. */
function toSqliteDate(date: Date) {
  return `${date.toISOString().replace('T', ' ').replace('Z', '')} +00:00`;
}

/**
 * Sets updatedAt directly, so delta-pull tests can place rows on either side of a cursor
 * instead of racing the clock.
 *
 * Raw SQL rather than Model.update, because `silent: true` — the only way to stop Sequelize
 * overwriting updatedAt with "now" — also discards an updatedAt passed in the values.
 */
export async function setUpdatedAt(id: string, updatedAt: Date) {
  await sequelize.query('UPDATE inspections SET updatedAt = ? WHERE id = ?', {
    replacements: [toSqliteDate(updatedAt), id],
  });
}

export async function closeDb() {
  await sequelize.close();
}
