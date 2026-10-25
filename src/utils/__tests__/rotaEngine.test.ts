import { describe, it, expect } from 'vitest';
import { generateRota, getMondayStartDate } from '../rotaEngine';
import { INITIAL_STAFF } from '../../data/initialData';
import type { Holiday, Staff } from '../../types';

describe('Rota Scheduling Engine Tests', () => {
  it('starts the rota on the Monday of the current calendar week', () => {
    expect(getMondayStartDate(new Date(2026, 9, 24, 12))).toBe('2026-10-19');
    expect(getMondayStartDate(new Date(2026, 9, 26, 12))).toBe('2026-10-26');
  });

  it('preserves the anchored 14-day staff pattern when rolling the rota forward', () => {
    const staff: Staff[] = [{
      id: 'pattern-test',
      name: 'Pattern Test',
      role: 'Carer',
      contractedHours: 44,
      defaultPattern: { 0: 'E/L', 7: 'N' },
    }];

    const { rota: firstCycleWeek } = generateRota(staff, [], {}, '2026-10-19', 7, '2026-08-10');
    const { rota: secondCycleWeek } = generateRota(staff, [], {}, '2026-10-26', 7, '2026-08-10');

    expect(firstCycleWeek[0].shifts['pattern-test']?.shiftLabel).toBe('E/L');
    expect(secondCycleWeek[0].shifts['pattern-test']?.shiftLabel).toBe('N');
  });

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

  it('returns multiple eligible holiday cover candidates in fair ranking order', () => {
    const staff: Staff[] = [
      { id: 'nurse-a', name: 'Nurse A', role: 'Staff Nurse', contractedHours: 44, defaultPattern: { 0: 'E/L' } },
      { id: 'nurse-b', name: 'Nurse B', role: 'Staff Nurse', contractedHours: 44, defaultPattern: {} },
      { id: 'nurse-c', name: 'Nurse C', role: 'Staff Nurse', contractedHours: 44, defaultPattern: {} },
    ];
    const holiday: Holiday = {
      id: 'h-ranked-cover', staffId: 'nurse-a', startDate: '2026-07-20', endDate: '2026-07-20',
    };

    const { rota, coverOptions } = generateRota(staff, [holiday], {}, '2026-07-20', 7);

    expect(rota[0].shifts['nurse-a']?.staffId).toBe('nurse-b');
    expect(coverOptions['2026-07-20:nurse-a']).toEqual(['nurse-b', 'nurse-c']);
  });

  it('changes the recommended cover on a seeded rebuild while keeping the eligible list', () => {
    const staff: Staff[] = [
      { id: 'nurse-a', name: 'Nurse A', role: 'Staff Nurse', contractedHours: 44, defaultPattern: { 0: 'E/L' } },
      { id: 'nurse-b', name: 'Nurse B', role: 'Staff Nurse', contractedHours: 44, defaultPattern: {} },
      { id: 'nurse-c', name: 'Nurse C', role: 'Staff Nurse', contractedHours: 44, defaultPattern: {} },
    ];
    const holiday: Holiday = {
      id: 'h-reshuffled-cover', staffId: 'nurse-a', startDate: '2026-07-20', endDate: '2026-07-20',
    };

    const { rota, coverOptions } = generateRota(
      staff, [holiday], {}, '2026-07-20', 7, '2026-07-20', 1,
      { startDate: '2026-07-20', endDate: '2026-07-27' }
    );

    expect(rota[0].shifts['nurse-a']?.staffId).toBe('nurse-c');
    expect(coverOptions['2026-07-20:nurse-a']).toEqual(['nurse-c', 'nurse-b']);
  });

  it('should automatically assign cover when a working staff member goes on holiday', () => {
    const testStaff: Staff[] = [
      {
        id: 'nurse-a',
        name: 'Nurse A',
        role: 'Staff Nurse',
        contractedHours: 44,
        defaultPattern: { 0: 'E/L' },
      },
      {
        id: 'nurse-b',
        name: 'Nurse B',
        role: 'Staff Nurse',
        contractedHours: 44,
        defaultPattern: {},
      },
    ];

    const holiday: Holiday = {
      id: 'h-test-1',
      staffId: 'nurse-a',
      startDate: '2026-07-20',
      endDate: '2026-07-20',
    };

    const { rota, covers } = generateRota(testStaff, [holiday], {}, '2026-07-20', 7);
    const monShifts = rota[0].shifts;

    expect(monShifts['nurse-a']).toBeDefined();
    expect(monShifts['nurse-a']?.isCover).toBe(true);
    expect(monShifts['nurse-a']?.staffId).toBe('nurse-b');
    expect(monShifts['nurse-a']?.originalStaffId).toBe('nurse-a');

    expect(covers).toHaveLength(1);
    expect(covers[0].coverStaffId).toBe('nurse-b');
    expect(covers[0].originalStaffId).toBe('nurse-a');
  });

  it('should not request cover for maternity leave shifts', () => {
    const testStaff: Staff[] = [
      {
        id: 'nurse-a',
        name: 'Nurse A',
        role: 'Staff Nurse',
        contractedHours: 44,
        defaultPattern: { 0: 'ML' },
      },
      {
        id: 'nurse-b',
        name: 'Nurse B',
        role: 'Staff Nurse',
        contractedHours: 44,
        defaultPattern: {},
      },
    ];

    const holiday: Holiday = {
      id: 'h-test-ml',
      staffId: 'nurse-a',
      startDate: '2026-07-20',
      endDate: '2026-07-20',
    };

    const { rota, covers } = generateRota(testStaff, [holiday], {}, '2026-07-20', 7);

    expect(rota[0].shifts['nurse-a']).toEqual({
      staffId: 'nurse-a',
      shiftLabel: 'ML',
      isCover: false,
    });
    expect(covers).toHaveLength(0);
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

  it('should use Activities special qualification for Activities holiday cover', () => {
    const testStaff: Staff[] = [
      {
        id: 'activities-a',
        name: 'Activities A',
        role: 'Activities',
        contractedHours: 40,
        defaultPattern: { 0: '8/5.30' },
      },
      {
        id: 'carer-a',
        name: 'Carer A',
        role: 'Carer',
        contractedHours: 44,
        defaultPattern: {},
      },
      {
        id: 'carer-b',
        name: 'Carer B',
        role: 'Carer',
        contractedHours: 44,
        isQualifiedForActivities: true,
        defaultPattern: {},
      },
    ];

    const holidays: Holiday[] = [
      {
        id: 'h-activities',
        staffId: 'activities-a',
        startDate: '2026-07-20',
        endDate: '2026-07-20',
      },
    ];

    const { rota } = generateRota(testStaff, holidays, {}, '2026-07-20', 7);

    expect(rota[0].shifts['activities-a']).toBeDefined();
    expect(rota[0].shifts['activities-a']?.staffId).toBe('carer-b');
  });

  it('should use Domestic/Laundry special qualification for domestic holiday cover', () => {
    const testStaff: Staff[] = [
      {
        id: 'domestic-a',
        name: 'Domestic A',
        role: 'Domestic/Laundry',
        contractedHours: 30,
        defaultPattern: { 0: '12/6' },
      },
      {
        id: 'carer-a',
        name: 'Carer A',
        role: 'Carer',
        contractedHours: 44,
        defaultPattern: {},
      },
      {
        id: 'carer-b',
        name: 'Carer B',
        role: 'Carer',
        contractedHours: 44,
        isQualifiedForDomesticLaundry: true,
        defaultPattern: {},
      },
    ];

    const holidays: Holiday[] = [
      {
        id: 'h-domestic',
        staffId: 'domestic-a',
        startDate: '2026-07-20',
        endDate: '2026-07-20',
      },
    ];

    const { rota } = generateRota(testStaff, holidays, {}, '2026-07-20', 7);

    expect(rota[0].shifts['domestic-a']).toBeDefined();
    expect(rota[0].shifts['domestic-a']?.staffId).toBe('carer-b');
  });
});
