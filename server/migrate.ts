/**
 * Run once to create tables and seed initial staff.
 *   npm run migrate
 */
import 'dotenv/config';
import { sql } from './db.js';

async function migrate() {
  console.log('▶ Running migrations…');

  // ── Create tables ────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS staff (
      id                            TEXT    PRIMARY KEY,
      name                          TEXT    NOT NULL,
      role                          TEXT    NOT NULL,
      contracted_hours              NUMERIC NOT NULL,
      shift_preference              TEXT    DEFAULT 'Mixed',
      is_qualified_for_shift_leader BOOLEAN DEFAULT FALSE,
      is_qualified_for_kitchen      BOOLEAN DEFAULT FALSE,
      staff_ref                     TEXT,
      default_pattern               JSONB   NOT NULL DEFAULT '{}'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS holidays (
      id         TEXT PRIMARY KEY,
      staff_id   TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date   DATE NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS manual_overrides (
      date       TEXT  NOT NULL,
      staff_id   TEXT  NOT NULL,
      shift_data JSONB NOT NULL,
      PRIMARY KEY (date, staff_id)
    )
  `;

  console.log('  ✓ Tables ready');

  // ── Seed initial staff if empty ───────────────────────────────────────────
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM staff`;
  if (Number(count) > 0) {
    console.log(`  ℹ Staff table already has ${count} records — skipping seed`);
  } else {
    console.log('  ▶ Seeding initial staff…');

    // Dynamic import so we don't import at module level (allows tsx to resolve it)
    const { INITIAL_STAFF } = await import('../src/data/initialData.js');

    for (const s of INITIAL_STAFF) {
      await sql`
        INSERT INTO staff
          (id, name, role, contracted_hours, shift_preference,
           is_qualified_for_shift_leader, is_qualified_for_kitchen,
           staff_ref, default_pattern)
        VALUES (
          ${s.id}, ${s.name}, ${s.role}, ${s.contractedHours},
          ${s.shiftPreference ?? 'Mixed'},
          ${s.isQualifiedForShiftLeader ?? false},
          ${s.isQualifiedForKitchen ?? false},
          ${s.staffRef ?? null},
          ${JSON.stringify(s.defaultPattern)}::jsonb
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }

    // Seed the two sample holidays
    await sql`
      INSERT INTO holidays (id, staff_id, start_date, end_date) VALUES
        ('h-1', 'jahanvi-bh', '2026-07-22', '2026-07-24'),
        ('h-2', 'becky-ovu',  '2026-07-21', '2026-07-23')
      ON CONFLICT (id) DO NOTHING
    `;

    console.log(`  ✓ Seeded ${INITIAL_STAFF.length} staff members + 2 sample holidays`);
  }

  console.log('✓ Migration complete');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('✗ Migration failed:', err);
  process.exit(1);
});
