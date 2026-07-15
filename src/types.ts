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
