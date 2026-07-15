import type { Staff, Holiday, DayRota, RotaShift, CoverRecord, Role } from '../types';
import { SHIFT_DEFINITIONS } from '../data/initialData';

// Rest constraints and date helper utilities
export const getDatesInRange = (startDateStr: string, totalDays: number): string[] => {
  const dates: string[] = [];
  const start = new Date(startDateStr);
  for (let i = 0; i < totalDays; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    dates.push(current.toISOString().split('T')[0]);
  }
  return dates;
};

export const getDayOfWeekIndex = (dateStr: string): number => {
  // JavaScript Date.getDay() returns 0 for Sunday, 1 for Monday, ..., 6 for Saturday.
  // We want: 0 = Mon, 1 = Tue, 2 = Wed, 3 = Thu, 4 = Fri, 5 = Sat, 6 = Sun.
  const d = new Date(dateStr);
  const jsDay = d.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
};

// Cross-cover eligibility rules
const CROSS_COVER_ELIGIBILITY: Record<Role, Role[]> = {
  'Manager': [],
  'Staff Nurse': ['Bank'], // Staff nurse shifts can only be covered by Nurses or qualified Bank
  'Shift Leader': ['Staff Nurse', 'Bank'], // Ezekiel Ola is a carer qualified for Shift Leader, handled dynamically
  'Carer': ['Shift Leader', 'Staff Nurse', 'Bank'],
  'Activities': [],
  'Kitchen': ['Carer', 'Bank'], // Oluwaseun is qualified for Kitchen, handled dynamically
  'Domestic/Laundry': ['Bank'],
  'Bank': ['Carer', 'Shift Leader'],
};

interface CoverState {
  extraShiftsCount: Record<string, number>;
  lastCoverDate: Record<string, string>; // staffId -> YYYY-MM-DD
}

export function generateRota(
  staffList: Staff[],
  holidays: Holiday[],
  manualOverrides: Record<string, Record<string, RotaShift>> = {},
  startDateStr: string = '2026-07-20',
  totalDays: number = 28
): { rota: DayRota[]; covers: CoverRecord[] } {
  const dates = getDatesInRange(startDateStr, totalDays);
  const coversList: CoverRecord[] = [];

  // Track extra shifts and last cover date for fair rotation
  const coverState: CoverState = {
    extraShiftsCount: {},
    lastCoverDate: {},
  };

  // Initialize cover stats for all staff
  staffList.forEach((s) => {
    coverState.extraShiftsCount[s.id] = 0;
    coverState.lastCoverDate[s.id] = '1970-01-01'; // Far past
  });

  // Intermediate rota storage: date -> staffId -> RotaShift
  const rotaData: Record<string, Record<string, RotaShift>> = {};

  // Step 1: Initialize all days with default shift patterns (14-day cycle)
  dates.forEach((dateStr, idx) => {
    rotaData[dateStr] = {};
    const cycleDayIndex = idx % 14;

    staffList.forEach((staff) => {
      const defaultShift = staff.defaultPattern[cycleDayIndex];
      if (defaultShift) {
        rotaData[dateStr][staff.id] = {
          staffId: staff.id,
          shiftLabel: defaultShift,
          isCover: false,
        };
      }
    });
  });

  // Step 2: Apply holidays and flag those shifts as needing cover
  dates.forEach((dateStr) => {
    const dayTime = new Date(dateStr).getTime();

    holidays.forEach((holiday) => {
      const hStart = new Date(holiday.startDate).getTime();
      const hEnd = new Date(holiday.endDate).getTime();

      // If this date is within the holiday range
      if (dayTime >= hStart && dayTime <= hEnd) {
        const scheduledShift = rotaData[dateStr]?.[holiday.staffId];
        // If they were scheduled to work, mark as needing cover
        if (scheduledShift && scheduledShift.shiftLabel && scheduledShift.shiftLabel !== 'Off') {
          rotaData[dateStr][holiday.staffId] = {
            staffId: holiday.staffId,
            shiftLabel: scheduledShift.shiftLabel,
            isCover: true,
            coverReason: 'Holiday',
            originalStaffId: holiday.staffId,
          };
        }
      }
    });
  });

  // Helper function to check for rest conflicts
  const checkRestConflict = (
    candidateId: string,
    dateStr: string,
    targetShiftLabel: string
  ): boolean => {
    const targetDef = SHIFT_DEFINITIONS[targetShiftLabel];
    if (!targetDef) return false;

    // A candidate cannot work if they already have a shift assigned on that day
    const existingShift = rotaData[dateStr]?.[candidateId];
    if (existingShift && existingShift.shiftLabel && !existingShift.isCover) {
      // If they are scheduled to work their regular shift, they cannot cover
      return true;
    }

    // Rest requirements:
    // 1. If covering a NIGHT shift, they must not work a DAY shift on that day or the next day.
    // 2. If covering a DAY shift, they must not work a NIGHT shift on the previous day or the same day.
    const targetDate = new Date(dateStr);

    const prevDate = new Date(targetDate);
    prevDate.setDate(targetDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];

    const nextDate = new Date(targetDate);
    nextDate.setDate(targetDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];

    const prevShift = rotaData[prevDateStr]?.[candidateId];
    const nextShift = rotaData[nextDateStr]?.[candidateId];

    if (targetDef.category === 'Night') {
      // Cannot work Day shift on the next day
      if (nextShift && nextShift.shiftLabel) {
        const nextDef = SHIFT_DEFINITIONS[nextShift.shiftLabel];
        if (nextDef && nextDef.category === 'Day') return true;
      }
    }

    if (targetDef.category === 'Day') {
      // Cannot work Night shift on the previous day
      if (prevShift && prevShift.shiftLabel) {
        const prevDef = SHIFT_DEFINITIONS[prevShift.shiftLabel];
        if (prevDef && prevDef.category === 'Night') return true;
      }
    }

    return false;
  };

  // Step 3: Resolve coverages chronologically day-by-day
  dates.forEach((dateStr) => {
    const staffWithVacancies = Object.keys(rotaData[dateStr]).filter(
      (staffId) => rotaData[dateStr][staffId].isCover && !rotaData[dateStr][staffId].originalStaffId?.includes('resolved')
    );

    staffWithVacancies.forEach((vacantStaffId) => {
      const vacancy = rotaData[dateStr][vacantStaffId];
      const origStaff = staffList.find((s) => s.id === vacantStaffId);
      if (!origStaff) return;

      const targetRole = origStaff.role;
      const shiftLabel = vacancy.shiftLabel;

      // Find candidates
      const candidates = staffList.filter((candidate) => {
        // Cannot cover yourself
        if (candidate.id === vacantStaffId) return false;

        // Candidate must not be on holiday themselves
        const isCandidateOnHoliday = holidays.some((h) => {
          if (h.staffId !== candidate.id) return false;
          const hStart = new Date(h.startDate).getTime();
          const hEnd = new Date(h.endDate).getTime();
          const dTime = new Date(dateStr).getTime();
          return dTime >= hStart && dTime <= hEnd;
        });
        if (isCandidateOnHoliday) return false;

        // Check if candidate is qualified for the role
        let roleQualified = false;
        if (candidate.role === targetRole) {
          roleQualified = true;
        } else {
          // Check cross-cover rules
          const allowedCrossRoles = CROSS_COVER_ELIGIBILITY[targetRole] || [];
          if (allowedCrossRoles.includes(candidate.role)) {
            roleQualified = true;
          }
          // Special qualified flags
          if (targetRole === 'Shift Leader' && candidate.isQualifiedForShiftLeader) {
            roleQualified = true;
          }
          if (targetRole === 'Kitchen' && candidate.isQualifiedForKitchen) {
            roleQualified = true;
          }
        }

        if (!roleQualified) return false;

        // Check shift preference constraint (e.g. permanent night staff cannot work day shifts, and day-only staff cannot work night shifts)
        const shiftDef = SHIFT_DEFINITIONS[shiftLabel];
        const shiftCategory = shiftDef ? shiftDef.category : 'Off';
        const pref = candidate.shiftPreference || 'Mixed';
        if (pref !== 'Mixed') {
          if (pref === 'Day' && shiftCategory === 'Night') return false;
          if (pref === 'Night' && shiftCategory !== 'Night') return false;
        }

        // Check rest schedule conflicts
        if (checkRestConflict(candidate.id, dateStr, shiftLabel)) return false;

        return true;
      });

      if (candidates.length > 0) {
        // Sort candidates based on:
        // 1. Same-role match first (exact role preferred over cross-cover)
        // 2. Extra shifts count (fewer extra shifts worked = higher priority)
        // 3. Last cover date (older cover date = higher priority / least recently worked extra)
        // 4. Deterministic fallback (id alphabet)
        candidates.sort((a, b) => {
          const aSameRole = a.role === targetRole ? 0 : 1;
          const bSameRole = b.role === targetRole ? 0 : 1;
          if (aSameRole !== bSameRole) return aSameRole - bSameRole;

          const aCount = coverState.extraShiftsCount[a.id] || 0;
          const bCount = coverState.extraShiftsCount[b.id] || 0;
          if (aCount !== bCount) return aCount - bCount;

          const aDate = new Date(coverState.lastCoverDate[a.id] || '1970-01-01').getTime();
          const bDate = new Date(coverState.lastCoverDate[b.id] || '1970-01-01').getTime();
          if (aDate !== bDate) return aDate - bDate;

          return a.id.localeCompare(b.id);
        });

        // Select the fairest candidate
        const selectedCover = candidates[0];

        // Update cover stats
        coverState.extraShiftsCount[selectedCover.id] = (coverState.extraShiftsCount[selectedCover.id] || 0) + 1;
        coverState.lastCoverDate[selectedCover.id] = dateStr;

        // Update Rota
        rotaData[dateStr][vacantStaffId] = {
          staffId: selectedCover.id,
          shiftLabel: shiftLabel,
          isCover: true,
          coverReason: 'Holiday',
          originalStaffId: vacantStaffId,
        };

        // Track this cover transaction
        coversList.push({
          id: `${dateStr}-${vacantStaffId}-${selectedCover.id}`,
          date: dateStr,
          shiftLabel: shiftLabel,
          originalStaffId: vacantStaffId,
          coverStaffId: selectedCover.id,
          reason: 'Holiday',
          timestamp: Date.now(),
        });
      } else {
        // No cover could be found (shortage)
        rotaData[dateStr][vacantStaffId] = {
          staffId: '', // Unassigned
          shiftLabel: shiftLabel,
          isCover: true,
          coverReason: 'Shortage',
          originalStaffId: vacantStaffId,
        };
      }
    });
  });

  // Step 4: Apply manual overrides at the end
  Object.keys(manualOverrides).forEach((dateStr) => {
    if (!rotaData[dateStr]) rotaData[dateStr] = {};

    Object.keys(manualOverrides[dateStr]).forEach((staffId) => {
      rotaData[dateStr][staffId] = {
        ...rotaData[dateStr][staffId],
        ...manualOverrides[dateStr][staffId],
      };
    });
  });

  // Step 5: Format the data into DayRota structures and calculate staffing numbers
  const formattedRota: DayRota[] = dates.map((dateStr) => {
    const dayOfWeek = getDayOfWeekIndex(dateStr);
    const dayShifts = rotaData[dateStr] || {};

    // Calculate staffing levels
    // From sample: Earlies = 4, Lates = 4, Nights = 3
    // E/L and M/L shifts count as both Early and Late (Long Day)
    // N shifts count as Night
    let scheduledEarlies = 0;
    let scheduledLates = 0;
    let scheduledNights = 0;

    Object.values(dayShifts).forEach((s) => {
      if (!s.staffId) return; // Unassigned shift does not count

      const def = SHIFT_DEFINITIONS[s.shiftLabel];
      if (!def) return;

      // Only care staff (Nurses, Shift Leaders, Carers, Bank) count towards floor staffing levels
      const staff = staffList.find((emp) => emp.id === s.staffId);
      const originalStaff = s.originalStaffId ? staffList.find((emp) => emp.id === s.originalStaffId) : null;
      const activeRole = staff?.role || originalStaff?.role;

      if (
        activeRole === 'Staff Nurse' ||
        activeRole === 'Shift Leader' ||
        activeRole === 'Carer' ||
        activeRole === 'Bank'
      ) {
        if (def.category === 'Day') {
          scheduledEarlies++;
          scheduledLates++;
        } else if (def.category === 'Night') {
          scheduledNights++;
        }
      }
    });

    return {
      date: dateStr,
      dayOfWeek,
      shifts: dayShifts,
      staffingStatus: {
        needed: { Earlies: 4, Lates: 4, Nights: 3 },
        scheduled: {
          Earlies: scheduledEarlies,
          Lates: scheduledLates,
          Nights: scheduledNights,
        },
      },
    };
  });

  return { rota: formattedRota, covers: coversList };
}
