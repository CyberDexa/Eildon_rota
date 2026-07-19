import 'dotenv/config';
import { sql } from './db.js';
import bcrypt from 'bcryptjs';

async function migrate() {
  console.log('▶ Running migrations…');

  await sql`
    CREATE TABLE IF NOT EXISTS staff (
      id                            TEXT    PRIMARY KEY,
      name                          TEXT    NOT NULL,
      role                          TEXT    NOT NULL,
      contracted_hours              NUMERIC NOT NULL,
      shift_preference              TEXT    DEFAULT 'Mixed',
      is_qualified_for_shift_leader BOOLEAN DEFAULT FALSE,
      is_qualified_for_kitchen      BOOLEAN DEFAULT FALSE,
      is_qualified_for_activities   BOOLEAN DEFAULT FALSE,
      is_qualified_for_domestic_laundry BOOLEAN DEFAULT FALSE,
      staff_ref                     TEXT,
      default_pattern               JSONB   NOT NULL DEFAULT '{}'
    )
  `;

  await sql`
    ALTER TABLE staff
    ADD COLUMN IF NOT EXISTS is_qualified_for_activities BOOLEAN DEFAULT FALSE
  `;

  await sql`
    ALTER TABLE staff
    ADD COLUMN IF NOT EXISTS is_qualified_for_domestic_laundry BOOLEAN DEFAULT FALSE
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

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log('  ✓ Tables ready');

  // ── Seed manager account ──────────────────────────────────────────────────
  const [{ userCount }] = await sql`SELECT COUNT(*)::int AS "userCount" FROM users`;
  if (Number(userCount) === 0) {
    const initialPwd = process.env.INITIAL_MANAGER_PASSWORD ?? 'Eildon2026!';
    const hash = await bcrypt.hash(initialPwd, 10);
    await sql`
      INSERT INTO users (id, username, password_hash, role)
      VALUES ('manager-1', 'manager', ${hash}, 'manager')
      ON CONFLICT (id) DO NOTHING
    `;
    console.log(`  ✓ Manager account created  (username: manager  |  password: ${initialPwd})`);
    console.log('  ⚠  Change this password after first login!');
  } else {
    console.log('  ℹ Users table already populated — skipping seed');
  }

  // ── Seed initial staff if empty ───────────────────────────────────────────
  const [{ staffCount }] = await sql`SELECT COUNT(*)::int AS "staffCount" FROM staff`;
  if (Number(staffCount) > 0) {
    console.log(`  ℹ Staff table has ${staffCount} records — skipping seed`);
  } else {
    console.log('  ▶ Seeding initial staff…');
    const { INITIAL_STAFF } = await import('../src/data/initialData.js');

    for (const s of INITIAL_STAFF) {
      await sql`
        INSERT INTO staff
          (id, name, role, contracted_hours, shift_preference,
           is_qualified_for_shift_leader, is_qualified_for_kitchen,
           is_qualified_for_activities, is_qualified_for_domestic_laundry,
           staff_ref, default_pattern)
        VALUES (
          ${s.id}, ${s.name}, ${s.role}, ${s.contractedHours},
          ${s.shiftPreference ?? 'Mixed'},
          ${s.isQualifiedForShiftLeader ?? false},
          ${s.isQualifiedForKitchen ?? false},
          ${s.isQualifiedForActivities ?? false},
          ${s.isQualifiedForDomesticLaundry ?? false},
          ${s.staffRef ?? null},
          ${JSON.stringify(s.defaultPattern)}::jsonb
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }

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
