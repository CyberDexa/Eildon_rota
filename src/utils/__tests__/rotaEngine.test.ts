import { describe, it, expect } from 'vitest';
import { generateRota } from '../rotaEngine';
import { INITIAL_STAFF } from '../../data/initialData';
import type { Holiday, Staff } from '../../types';

describe('Rota Scheduling Engine Tests', () => {
  it('should generate default shift patterns correctly', () => {
    const { rota } = generateRota(INITIAL_STAFF, [], {}, '2026-07-20', 7);

    expect(rota).toHaveLength(7);

    // Verify Manager (Natasha T) default pattern: Mon-Fri '7/5', Sat-Sun off
    const monShifts = rota[0].shifts;
    expect(monShifts['natasha-t']).toEqual({
      staffId: 'natasha-t',
      shiftLabel: '7/5',
      isCover: false,
    });

    const satShifts = rota[5].shifts;
    expect(satShifts['natasha-t']).toBeUndefined(); // Off
  });

  it('should automatically assign cover when a staff member goes on holiday', () => {
    // Jahanvi Bh (Staff Nurse) goes on holiday on Mon July 20th
    const holiday: Holiday = {
      id: 'h-test-1',
      staffId: 'jahanvi-bh',
      startDate: '2026-07-20',
      endDate: '2026-07-20',
    };

    const { rota, covers } = generateRota(INITIAL_STAFF, [holiday], {}, '2026-07-20', 7);

    // Jahanvi had Mon shift "M/L".
    // Available Staff Nurses on Mon:
    // - Mariya pal (defaultPattern on Mon: Off)
    // - Kathleen R (defaultPattern on Mon: E/L -> Already working, so cannot cover!)
    // So Mariya pal is the only candidate available.
    const monShifts = rota[0].shifts;

    // Verify Jahanvi's shift is covered by Mariya pal
    expect(monShifts['jahanvi-bh']).toBeDefined();
    expect(monShifts['jahanvi-bh']?.isCover).toBe(true);
    expect(monShifts['jahanvi-bh']?.staffId).toBe('mariya-pal');
    expect(monShifts['jahanvi-bh']?.originalStaffId).toBe('jahanvi-bh');

    // Verify cover list has recorded it
    expect(covers).toHaveLength(1);
    expect(covers[0].coverStaffId).toBe('mariya-pal');
    expect(covers[0].originalStaffId).toBe('jahanvi-bh');
  });

  it('should follow fair rotation rules (least recently worked cover shift)', () => {
    // Let's create a custom list of carers for testing fair rotation
    const testCarers: Staff[] = [
      {
        id: 'carer-a',
        name: 'Carer A',
        role: 'Carer',
        contractedHours: 33,
        defaultPattern: {}, // Available every day
      },
      {
        id: 'carer-b',
        name: 'Carer B',
        role: 'Carer',
        contractedHours: 33,
        defaultPattern: {}, // Available every day
      },
    ];

    // Let's have a Carer C who works every day but goes on holiday on Mon and Tue
    const testStaff: Staff[] = [
      ...testCarers,
      {
        id: 'carer-c',
        name: 'Carer C',
        role: 'Carer',
        contractedHours: 44,
        defaultPattern: { 0: 'E/L', 1: 'E/L' },
      },
    ];

    const holidays: Holiday[] = [
      {
        id: 'h-1',
        staffId: 'carer-c',
        startDate: '2026-07-20', // Mon
        endDate: '2026-07-21', // Tue
      },
    ];

    const { covers } = generateRota(testStaff, holidays, {}, '2026-07-20', 7);

    // On Mon, one carer needs cover.
    // Carer A and Carer B both have 0 cover shifts. Let's say Carer A gets selected first (alphabetical tie-breaker).
    // On Tue, another carer needs cover.
    // Carer A has 1 cover shift, Carer B has 0 cover shifts.
    // So Carer B MUST get selected for the Tuesday cover shift to keep it fair!

    expect(covers).toHaveLength(2);
    expect(covers[0].date).toBe('2026-07-20');
    expect(covers[0].coverStaffId).toBe('carer-a');

    expect(covers[1].date).toBe('2026-07-21');
    expect(covers[1].coverStaffId).toBe('carer-b');
  });

  it('should prevent rest conflicts (no Day shift immediately following Night shift)', () => {
    // Create test staff
    // Carer A works Monday Night (N)
    // Carer B is available
    // Carer C works Monday and Tuesday Day shifts but goes on holiday on Tuesday Day (E/L)
    const testStaff: Staff[] = [
      {
        id: 'carer-a',
        name: 'Carer A',
        role: 'Carer',
        contractedHours: 44,
        defaultPattern: { 0: 'N' }, // Works Mon Night
      },
      {
        id: 'carer-b',
        name: 'Carer B',
        role: 'Carer',
        contractedHours: 44,
        defaultPattern: {}, // Available
      },
      {
        id: 'carer-c',
        name: 'Carer C',
        role: 'Carer',
        contractedHours: 44,
        defaultPattern: { 0: 'E/L', 1: 'E/L' }, // Works Mon & Tue Day, goes on holiday on Tue
      },
    ];

    const holidays: Holiday[] = [
      {
        id: 'h-1',
        staffId: 'carer-c',
        startDate: '2026-07-21', // Tue
        endDate: '2026-07-21',
      },
    ];

    const { rota } = generateRota(testStaff, holidays, {}, '2026-07-20', 7);

    // On Tuesday, Carer C's Day shift ("E/L") needs cover.
    // Candidates:
    // - Carer A: worked Night (N) on Mon. If they cover Tue Day (E/L), that violates rest constraints! (Night shift Mon ends Tue 6 AM, Day shift starts Tue 7 AM, only 1 hour rest!).
    // - Carer B: off on Mon. Completely free.
    // So Carer B MUST be chosen to cover, even if Carer A would normally be chosen first due to alphabet.

    const tueShifts = rota[1].shifts;
    expect(tueShifts['carer-c']).toBeDefined();
    expect(tueShifts['carer-c']?.staffId).toBe('carer-b'); // Carer B covers!
  });

  it('should respect shiftPreference constraints (Day-only vs Night-only)', () => {
    // Carer A works Monday Day but goes on holiday.
    // Candidate 1: Carer B is Night-only preference.
    // Candidate 2: Carer C is Day-only preference.
    const testStaff: Staff[] = [
      {
        id: 'carer-a',
        name: 'Carer A',
        role: 'Carer',
        contractedHours: 44,
        defaultPattern: { 0: 'E/L' }, // Mon Day, goes on holiday
      },
      {
        id: 'carer-b',
        name: 'Carer B',
        role: 'Carer',
        contractedHours: 44,
        shiftPreference: 'Night', // Night only!
        defaultPattern: {},
      },
      {
        id: 'carer-c',
        name: 'Carer C',
        role: 'Carer',
        contractedHours: 44,
        shiftPreference: 'Day', // Day only!
        defaultPattern: {},
      },
    ];

    const holidays: Holiday[] = [
      {
        id: 'h-1',
        staffId: 'carer-a',
        startDate: '2026-07-20',
        endDate: '2026-07-20',
      },
    ];

    const { rota } = generateRota(testStaff, holidays, {}, '2026-07-20', 7);

    // Carer A's Day shift needs cover.
    // Candidate B is Night-only, so CANNOT cover.
    // Candidate C is Day-only, so CAN cover.
    // Verify Carer C covers.
    const monShifts = rota[0].shifts;
    expect(monShifts['carer-a']).toBeDefined();
    expect(monShifts['carer-a']?.staffId).toBe('carer-c');
  });
});
