import { Router } from 'express';
import { sql } from './db.js';
import type { Staff, Holiday, RotaShift } from '../src/types.js';

export const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToStaff(row: Record<string, unknown>): Staff {
  return {
    id: row.id as string,
    name: row.name as string,
    role: row.role as Staff['role'],
    contractedHours: Number(row.contracted_hours),
    shiftPreference: row.shift_preference as Staff['shiftPreference'],
    isQualifiedForShiftLeader: Boolean(row.is_qualified_for_shift_leader),
    isQualifiedForKitchen: Boolean(row.is_qualified_for_kitchen),
    isQualifiedForActivities: Boolean(row.is_qualified_for_activities),
    isQualifiedForDomesticLaundry: Boolean(row.is_qualified_for_domestic_laundry),
    staffRef: (row.staff_ref as string | null) ?? undefined,
    // JSON keys come back as strings from Postgres — convert to numbers
    defaultPattern: Object.fromEntries(
      Object.entries(row.default_pattern as Record<string, string>).map(([k, v]) => [Number(k), v])
    ) as Record<number, string>,
  };
}

function rowToHoliday(row: Record<string, unknown>): Holiday {
  const fmt = (d: unknown) =>
    typeof d === 'string' ? d.substring(0, 10) : (d as Date).toISOString().substring(0, 10);
  return {
    id: row.id as string,
    staffId: row.staff_id as string,
    startDate: fmt(row.start_date),
    endDate: fmt(row.end_date),
  };
}

// ─── Staff ────────────────────────────────────────────────────────────────────

router.get('/staff', async (_req, res) => {
  try {
    const rows = await sql`SELECT * FROM staff ORDER BY role, name`;
    res.json(rows.map((r) => rowToStaff(r as Record<string, unknown>)));
  } catch (err) {
    console.error('[GET /staff]', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

router.post('/staff', async (req, res) => {
  try {
    const s = req.body as Staff;
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
    `;
    const rows = await sql`SELECT * FROM staff WHERE id = ${s.id}`;
    res.status(201).json(rowToStaff(rows[0] as Record<string, unknown>));
  } catch (err) {
    console.error('[POST /staff]', err);
    res.status(500).json({ error: 'Failed to create staff member' });
  }
});

router.put('/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body as Partial<Omit<Staff, 'id'>>;

    // Read current record, merge updates, write full row back.
    // This avoids dynamic column parameterisation with the tagged-template SQL client.
    const current = await sql`SELECT * FROM staff WHERE id = ${id}`;
    if (current.length === 0) return void res.status(404).json({ error: 'Staff not found' });

    const c = rowToStaff(current[0] as Record<string, unknown>);
    const m: Staff = { ...c, ...updates };

    await sql`
      UPDATE staff SET
        name                          = ${m.name},
        role                          = ${m.role},
        contracted_hours              = ${m.contractedHours},
        shift_preference              = ${m.shiftPreference ?? 'Mixed'},
        is_qualified_for_shift_leader = ${m.isQualifiedForShiftLeader ?? false},
        is_qualified_for_kitchen      = ${m.isQualifiedForKitchen ?? false},
        is_qualified_for_activities   = ${m.isQualifiedForActivities ?? false},
        is_qualified_for_domestic_laundry = ${m.isQualifiedForDomesticLaundry ?? false},
        staff_ref                     = ${m.staffRef ?? null},
        default_pattern               = ${JSON.stringify(m.defaultPattern)}::jsonb
      WHERE id = ${id}
    `;

    const updated = await sql`SELECT * FROM staff WHERE id = ${id}`;
    res.json(rowToStaff(updated[0] as Record<string, unknown>));
  } catch (err) {
    console.error('[PUT /staff/:id]', err);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

router.delete('/staff/:id', async (req, res) => {
  try {
    await sql`DELETE FROM staff WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /staff/:id]', err);
    res.status(500).json({ error: 'Failed to delete staff member' });
  }
});

// ─── Holidays ─────────────────────────────────────────────────────────────────

router.get('/holidays', async (_req, res) => {
  try {
    const rows = await sql`SELECT * FROM holidays ORDER BY start_date`;
    res.json(rows.map((r) => rowToHoliday(r as Record<string, unknown>)));
  } catch (err) {
    console.error('[GET /holidays]', err);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

router.post('/holidays', async (req, res) => {
  try {
    const h = req.body as Holiday;
    await sql`
      INSERT INTO holidays (id, staff_id, start_date, end_date)
      VALUES (${h.id}, ${h.staffId}, ${h.startDate}, ${h.endDate})
    `;
    const rows = await sql`SELECT * FROM holidays WHERE id = ${h.id}`;
    res.status(201).json(rowToHoliday(rows[0] as Record<string, unknown>));
  } catch (err) {
    console.error('[POST /holidays]', err);
    res.status(500).json({ error: 'Failed to create holiday' });
  }
});

router.delete('/holidays/:id', async (req, res) => {
  try {
    await sql`DELETE FROM holidays WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /holidays/:id]', err);
    res.status(500).json({ error: 'Failed to delete holiday' });
  }
});

// ─── Manual Overrides ────────────────────────────────────────────────────────

router.get('/overrides', async (_req, res) => {
  try {
    const rows = await sql`SELECT * FROM manual_overrides`;
    const overrides: Record<string, Record<string, RotaShift>> = {};
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const date = r.date as string;
      const staffId = r.staff_id as string;
      if (!overrides[date]) overrides[date] = {};
      overrides[date][staffId] = r.shift_data as RotaShift;
    }
    res.json(overrides);
  } catch (err) {
    console.error('[GET /overrides]', err);
    res.status(500).json({ error: 'Failed to fetch overrides' });
  }
});

router.put('/overrides', async (req, res) => {
  try {
    const { date, staffId, shift } = req.body as {
      date: string;
      staffId: string;
      shift: RotaShift;
    };
    await sql`
      INSERT INTO manual_overrides (date, staff_id, shift_data)
      VALUES (${date}, ${staffId}, ${JSON.stringify(shift)}::jsonb)
      ON CONFLICT (date, staff_id) DO UPDATE SET shift_data = EXCLUDED.shift_data
    `;
    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /overrides]', err);
    res.status(500).json({ error: 'Failed to save override' });
  }
});

router.delete('/overrides/single', async (req, res) => {
  try {
    const { date, staffId } = req.body as { date: string; staffId: string };
    await sql`DELETE FROM manual_overrides WHERE date = ${date} AND staff_id = ${staffId}`;
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /overrides/single]', err);
    res.status(500).json({ error: 'Failed to delete override' });
  }
});

router.delete('/overrides/all', async (_req, res) => {
  try {
    await sql`DELETE FROM manual_overrides`;
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /overrides/all]', err);
    res.status(500).json({ error: 'Failed to reset overrides' });
  }
});
