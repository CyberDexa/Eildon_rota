export type Role =
  | 'Manager'
  | 'Staff Nurse'
  | 'Shift Leader'
  | 'Carer'
  | 'Activities'
  | 'Kitchen'
  | 'Domestic/Laundry'
  | 'Bank';

export type ShiftCategory =
  | 'Day'
  | 'Night'
  | 'Management'
  | 'Activities'
  | 'Kitchen'
  | 'Domestic'
  | 'Off';

export interface ShiftDefinition {
  label: string;
  category: ShiftCategory;
  startTime: string;
  endTime: string;
  hours: number;
}

export interface Staff {
  id: string;
  name: string;
  role: Role;
  contractedHours: number;
  defaultPattern: Record<number, string>; // 0-6 = Week A (Mon-Sun), 7-13 = Week B (Mon-Sun)
  isQualifiedForShiftLeader?: boolean; // For Carers
  isQualifiedForKitchen?: boolean; // For Carers
  isQualifiedForActivities?: boolean;
  isQualifiedForDomesticLaundry?: boolean;
  shiftPreference?: 'Day' | 'Night' | 'Mixed'; // Added constraint: can be Day only, Night only, or Mixed
  staffRef?: string; // Staff Reference Code (e.g. Employee ID)
}

export interface Holiday {
  id: string;
  staffId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface RotaShift {
  staffId: string;
  shiftLabel: string;
  isCover: boolean;
  coverReason?: 'Holiday' | 'Shortage';
  originalStaffId?: string; // If cover is active, who was supposed to work
  isManualOverride?: boolean;
}

export interface DayRota {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 = Mon, 6 = Sun
  shifts: Record<string, RotaShift>; // staffId -> RotaShift
  staffingStatus: {
    needed: { Earlies: number; Lates: number; Nights: number };
    scheduled: { Earlies: number; Lates: number; Nights: number };
  };
}

export interface CoverRecord {
  id: string;
  date: string; // YYYY-MM-DD
  shiftLabel: string;
  originalStaffId: string;
  coverStaffId: string;
  reason: 'Holiday' | 'Shortage';
  timestamp: number;
}

export interface User {
  id: string;
  username: string;
  role: 'manager' | 'user';
}

// ─── AI Rota Assistant ────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RotaChatStaff {
  name: string;
  role: Role;
  contractedHours: number;
  shiftPreference: string;
  staffRef?: string;
  qualifications: string[];
}

export interface RotaChatDay {
  date: string;
  weekday: string;
  required: { earlies: number; lates: number; nights: number };
  scheduled: { earlies: number; lates: number; nights: number };
  shortages: { staff: string; role: Role; shift: string }[];
  holidayCover: { for: string; working: string | null; shift: string }[];
  onHoliday: string[];
}

/** A cover proposal from the AI reshuffle helper, already checked against the snapshot. */
export interface AiCoverSuggestion {
  date: string;
  shift: string;
  absentStaff: string;
  coverStaff: string;
  reason: string;
}

/** Compact snapshot of the live rota handed to the assistant as ground truth. */
export interface RotaChatContext {
  today: string;
  periodStart: string;
  periodEnd: string;
  focusWeek: { index: number; startDate: string; endDate: string; dates: string[] };
  requirements: { earlies: number; lates: number; nights: number };
  staff: RotaChatStaff[];
  days: RotaChatDay[];
  focusedWeekWorking: { date: string; working: string[] }[];
  /**
   * One row per person, keyed by date (YYYY-MM-DD) so nothing needs aligning.
   * Also covers the day before and after the week, for rest and consecutive-day checks.
   */
  focusWeekByStaff: { staff: string; shifts: Record<string, string> }[];
  holidays: { staff: string; startDate: string; endDate: string }[];
  coverLoad: { staff: string; coverShifts: number }[];
  manualEdits: number;
}
