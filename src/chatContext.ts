import type {
  Staff,
  Holiday,
  DayRota,
  CoverRecord,
  RotaShift,
  RotaChatContext,
  RotaChatDay,
} from './types';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Minimum floor staffing the dashboard checks each day against. */
export const STAFFING_REQUIREMENTS = { earlies: 4, lates: 4, nights: 3 };

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const weekdayFor = (dateStr: string): string => {
  const jsDay = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return WEEKDAY_LABELS[jsDay === 0 ? 6 : jsDay - 1];
};

const qualificationsFor = (staff: Staff): string[] => {
  const list: string[] = [];
  if (staff.isQualifiedForShiftLeader) list.push('shift leader');
  if (staff.isQualifiedForKitchen) list.push('kitchen');
  if (staff.isQualifiedForActivities) list.push('activities');
  if (staff.isQualifiedForDomesticLaundry) list.push('domestic/laundry');
  return list;
};

interface BuildRotaChatContextArgs {
  staffList: Staff[];
  holidays: Holiday[];
  rota: DayRota[];
  covers: CoverRecord[];
  manualOverrides: Record<string, Record<string, RotaShift>>;
  rotaStartDate: string;
  selectedWeek: number;
}

/**
 * Builds the compact, read-only snapshot the assistant reasons over.
 * Only aggregates and names travel — no credentials or user accounts.
 */
export function buildRotaChatContext({
  staffList,
  holidays,
  rota,
  covers,
  manualOverrides,
  rotaStartDate,
  selectedWeek,
}: BuildRotaChatContextArgs): RotaChatContext {
  const staffById = new Map(staffList.map((staff) => [staff.id, staff]));

  const days: RotaChatDay[] = rota.map((day) => {
    const onHoliday = holidays
      .filter((holiday) => day.date >= holiday.startDate && day.date <= holiday.endDate)
      .map((holiday) => staffById.get(holiday.staffId)?.name ?? holiday.staffId);

    const shortages = Object.values(day.shifts)
      .filter((shift) => shift.isCover && shift.coverReason === 'Shortage' && !shift.staffId)
      .map((shift) => {
        const original = shift.originalStaffId ? staffById.get(shift.originalStaffId) : undefined;
        return {
          staff: original?.name ?? shift.originalStaffId ?? 'Unknown',
          role: original?.role ?? ('Bank' as const),
          shift: shift.shiftLabel,
        };
      });

    const holidayCover = Object.values(day.shifts)
      .filter((shift) => shift.isCover && shift.coverReason === 'Holiday')
      .map((shift) => ({
        for: shift.originalStaffId
          ? staffById.get(shift.originalStaffId)?.name ?? shift.originalStaffId
          : 'Unknown',
        working: shift.staffId ? staffById.get(shift.staffId)?.name ?? shift.staffId : null,
        shift: shift.shiftLabel,
      }));

    return {
      date: day.date,
      weekday: weekdayFor(day.date),
      required: { ...STAFFING_REQUIREMENTS },
      scheduled: {
        earlies: day.staffingStatus.scheduled.Earlies,
        lates: day.staffingStatus.scheduled.Lates,
        nights: day.staffingStatus.scheduled.Nights,
      },
      shortages,
      holidayCover,
      onHoliday,
    };
  });

  const focusStart = addDays(rotaStartDate, selectedWeek * 7);
  const focusEnd = addDays(focusStart, 6);

  const focusDays = rota.filter((day) => day.date >= focusStart && day.date <= focusEnd);
  const focusDates = focusDays.map((day) => day.date);

  const focusedWeekWorking = focusDays.map((day) => ({
    date: day.date,
    working: Object.values(day.shifts)
      .filter((shift) => shift.shiftLabel && shift.shiftLabel !== 'Off' && !(shift.isCover && !shift.staffId))
      .map((shift) => {
        const person = shift.staffId ? staffById.get(shift.staffId) : undefined;
        const suggested = shift.isCover && shift.coverReason === 'Holiday' && !shift.isManualOverride;
        const tag = suggested
          ? ', suggested cover — not yet assigned'
          : shift.isCover
            ? ', cover'
            : '';
        return `${person?.name ?? 'Unassigned'} (${shift.shiftLabel}${tag})`;
      }),
  }));

  // Holidays are stated per cell so availability can never be inferred wrongly.
  const isOnHoliday = (staffId: string, date: string) =>
    holidays.some((h) => h.staffId === staffId && date >= h.startDate && date <= h.endDate);

  // One authoritative row per person so the assistant can see what someone is
  // ALREADY doing before proposing to move them. Covers own shifts and cover shifts.
  // Keyed by date: parallel arrays invite off-by-one misreads.
  const focusWeekByStaff = staffList.map((staff) => {
    const shifts: Record<string, string> = {};

    for (const day of focusDays) {
      const labels: string[] = [];
      const away = isOnHoliday(staff.id, day.date);

      for (const [rowId, shift] of Object.entries(day.shifts)) {
        if (!shift.shiftLabel || shift.shiftLabel === 'Off') continue;

        // Unfilled vacancy belongs to the person whose shift it was
        if (shift.isCover && !shift.staffId) {
          if (rowId === staff.id) {
            labels.push(`${shift.shiftLabel} (unfilled${away ? ', on holiday' : ', nobody assigned'})`);
          }
          continue;
        }

        const workingId = shift.isCover ? shift.staffId : rowId;
        if (workingId !== staff.id) continue;

        if (shift.isCover && shift.originalStaffId && shift.originalStaffId !== staff.id) {
          const original = staffById.get(shift.originalStaffId);
          const suggested = shift.coverReason === 'Holiday' && !shift.isManualOverride;
          labels.push(
            `${shift.shiftLabel} (${suggested ? 'suggested cover for' : 'covering'} ${original?.name ?? 'a colleague'})`
          );
        } else {
          labels.push(shift.shiftLabel);
        }
      }

      shifts[day.date] = labels.length > 0 ? labels.join(' + ') : away ? 'Off (holiday)' : 'Off';
    }

    return { staff: staff.name, shifts };
  });

  const coverLoad = staffList
    .map((staff) => ({
      staff: staff.name,
      coverShifts: covers.filter((cover) => cover.coverStaffId === staff.id).length,
    }))
    .sort((a, b) => b.coverShifts - a.coverShifts || a.staff.localeCompare(b.staff));

  return {
    today: new Date().toISOString().slice(0, 10),
    periodStart: rotaStartDate,
    periodEnd: addDays(rotaStartDate, 27),
    focusWeek: { index: selectedWeek, startDate: focusStart, endDate: focusEnd, dates: focusDates },
    requirements: { ...STAFFING_REQUIREMENTS },
    staff: staffList.map((staff) => ({
      name: staff.name,
      role: staff.role,
      contractedHours: staff.contractedHours,
      shiftPreference: staff.shiftPreference ?? 'Mixed',
      ...(staff.staffRef ? { staffRef: staff.staffRef } : {}),
      qualifications: qualificationsFor(staff),
    })),
    days,
    focusedWeekWorking,
    focusWeekByStaff,
    holidays: holidays.map((holiday) => ({
      staff: staffById.get(holiday.staffId)?.name ?? holiday.staffId,
      startDate: holiday.startDate,
      endDate: holiday.endDate,
    })),
    coverLoad,
    manualEdits: Object.values(manualOverrides).reduce(
      (total, shifts) => total + Object.keys(shifts).length,
      0
    ),
  };
}
