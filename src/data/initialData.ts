import type { Staff, ShiftDefinition } from '../types.js';

export const SHIFT_DEFINITIONS: Record<string, ShiftDefinition> = {
  'E/L': {
    label: 'E/L',
    category: 'Day',
    startTime: '07:30',
    endTime: '19:30',
    hours: 11,
  },
  'ML': {
    label: 'ML',
    category: 'Off',
    startTime: '',
    endTime: '',
    hours: 0,
  },
  'M/L': {
    label: 'M/L',
    category: 'Off',
    startTime: '',
    endTime: '',
    hours: 0,
  },
  'N': {
    label: 'N',
    category: 'Night',
    startTime: '19:30',
    endTime: '07:30',
    hours: 11,
  },
  '7/5': {
    label: '7/5',
    category: 'Management',
    startTime: '07:00',
    endTime: '17:00',
    hours: 8,
  },
  '8/5.30': {
    label: '8/5.30',
    category: 'Activities',
    startTime: '08:00',
    endTime: '17:30',
    hours: 8,
  },
  '8/5.3': {
    label: '8/5.3',
    category: 'Kitchen',
    startTime: '08:00',
    endTime: '17:00',
    hours: 9,
  },
  'E/L - K': {
    label: 'E/L - K',
    category: 'Kitchen',
    startTime: '07:00',
    endTime: '19:00',
    hours: 11,
  },
  '12/6': {
    label: '12/6',
    category: 'Domestic',
    startTime: '12:00',
    endTime: '18:00',
    hours: 6,
  },
  '8/2': {
    label: '8/2',
    category: 'Domestic',
    startTime: '08:00',
    endTime: '14:00',
    hours: 5.5,
  },
};

export const INITIAL_STAFF: Staff[] = [
  // Management
  {
    id: 'natasha-t',
    name: 'Natasha T',
    role: 'Manager',
    contractedHours: 40,
    shiftPreference: 'Day',
    staffRef: 'EIL-001',
    defaultPattern: {
      0: '7/5', 1: '7/5', 2: '7/5', 3: '7/5', 4: '7/5', // Week A
      7: '7/5', 8: '7/5', 9: '7/5', 10: '7/5', 11: '7/5', // Week B
    },
  },
  // Staff Nurses
  {
    id: 'jahanvi-bh',
    name: 'Jahanvi Bh',
    role: 'Staff Nurse',
    contractedHours: 44,
    shiftPreference: 'Day',
    staffRef: 'EIL-002',
    defaultPattern: {
      0: 'ML', 1: 'ML', 2: 'ML', 3: 'ML', // Week A
      7: 'ML', 8: 'ML', 9: 'ML', 10: 'ML', // Week B
    },
  },
  {
    id: 'mariya-pal',
    name: 'Mariya pal',
    role: 'Staff Nurse',
    contractedHours: 44,
    shiftPreference: 'Day',
    staffRef: 'EIL-003',
    defaultPattern: {
      2: 'E/L', 3: 'E/L', 4: 'E/L', 6: 'E/L', // Week A
      7: 'E/L', 8: 'E/L', 12: 'E/L', 13: 'E/L', // Week B
    },
  },
  {
    id: 'kathleen-r',
    name: 'Kathleen R',
    role: 'Staff Nurse',
    contractedHours: 38.5,
    shiftPreference: 'Day',
    staffRef: 'EIL-004',
    defaultPattern: {
      0: 'E/L', 1: 'E/L', 5: 'E/L', 6: 'E/L', // Week A (44 hours)
      9: 'E/L', 10: 'E/L', 11: 'E/L', // Week B (33 hours - Mon, Sat, Sun) -> Averages 38.5h
    },
  },
  // Shift Leaders
  {
    id: 'toheeb',
    name: 'Toheeb',
    role: 'Shift Leader',
    contractedHours: 44,
    shiftPreference: 'Mixed', // Works Day and Night
    staffRef: 'EIL-006',
    defaultPattern: {
      0: 'E/L', 3: 'E/L', 4: 'N', 5: 'N', // Week A
      7: 'E/L', 8: 'N', 10: 'E/L', 13: 'E/L', // Week B
    },
  },
  {
    id: 'ebenezer',
    name: 'Ebenezer',
    role: 'Shift Leader',
    contractedHours: 44,
    shiftPreference: 'Night', // Permanent Night Staff
    staffRef: 'EIL-007',
    defaultPattern: {
      0: 'N', 2: 'N', 3: 'N', 6: 'N', // Week A
      7: 'N', 9: 'N', 10: 'N', 13: 'N', // Week B
    },
  },
  // Bank Staff
  {
    id: 'adela',
    name: 'Adela',
    role: 'Bank',
    contractedHours: 0,
    shiftPreference: 'Mixed', // Bank covers anything
    staffRef: 'EIL-017',
    defaultPattern: {},
  },
  // Carers
  {
    id: 'ademola-a',
    name: 'Ademola A',
    role: 'Carer',
    contractedHours: 44,
    shiftPreference: 'Night', // Permanent Night Staff
    staffRef: 'EIL-008',
    defaultPattern: {
      0: 'N', 2: 'N', 3: 'N', 5: 'N', // Week A
      7: 'N', 10: 'N', 12: 'N', 13: 'N', // Week B
    },
  },
  {
    id: 'olabayo-o',
    name: 'Olabayo O',
    role: 'Carer',
    contractedHours: 44,
    shiftPreference: 'Night', // Permanent Night Staff
    staffRef: 'EIL-009',
    defaultPattern: {
      0: 'N', 1: 'N', 4: 'N', 6: 'N', // Week A
      8: 'N', 9: 'N', 11: 'N', 12: 'N', // Week B
    },
  },
  {
    id: 'becky-ovu',
    name: 'Becky Ovu',
    role: 'Carer',
    contractedHours: 44,
    shiftPreference: 'Night', // Permanent Night Staff
    staffRef: 'EIL-010',
    defaultPattern: {
      1: 'N', 2: 'N', 4: 'N', 5: 'N', // Week A
      8: 'N', 9: 'N', 11: 'N', 13: 'N', // Week B
    },
  },
  {
    id: 'moromoke',
    name: 'Moromoke',
    role: 'Carer',
    contractedHours: 44,
    shiftPreference: 'Day', // Day Only
    staffRef: 'EIL-011',
    defaultPattern: {
      1: 'E/L', 2: 'E/L', 5: 'E/L', 6: 'E/L', // Week A
      7: 'E/L', 9: 'E/L', 10: 'E/L', 11: 'E/L', // Week B
    },
  },
  {
    id: 'amitha-ra',
    name: 'Amitha Ra',
    role: 'Carer',
    contractedHours: 38.5,
    shiftPreference: 'Day', // Day Only
    staffRef: 'EIL-012',
    defaultPattern: {
      1: 'E/L', 2: 'E/L', 4: 'E/L', // Week A (33 hours)
      7: 'E/L', 9: 'E/L', 12: 'E/L', 13: 'E/L', // Week B (44 hours) -> Averages 38.5h
    },
  },
  {
    id: 'aljoiner-m',
    name: 'Aljoiner M',
    role: 'Carer',
    contractedHours: 33,
    shiftPreference: 'Day', // Day Only
    staffRef: 'EIL-013',
    defaultPattern: {
      1: 'E/L', 3: 'E/L', 4: 'E/L', // Week A
      8: 'E/L', 12: 'E/L', 13: 'E/L', // Week B
    },
  },
  {
    id: 'ezekiel-ola',
    name: 'Ezekiel Ola',
    role: 'Carer',
    contractedHours: 38.5,
    shiftPreference: 'Day', // Day Only
    staffRef: 'EIL-014',
    defaultPattern: {
      0: 'E/L', 2: 'E/L', 3: 'E/L', 5: 'E/L', // Week A (44 hours)
      8: 'E/L', 10: 'E/L', 11: 'E/L', // Week B (33 hours) -> Averages 38.5h
    },
  },
  {
    id: 'salonee-bh',
    name: 'Salonee Bh',
    role: 'Carer',
    contractedHours: 38.5,
    shiftPreference: 'Day', // Day Only
    staffRef: 'EIL-015',
    defaultPattern: {
      2: 'E/L', 3: 'E/L', 5: 'E/L', // Week A (33 hours)
      8: 'E/L', 10: 'E/L', 11: 'E/L', 13: 'E/L', // Week B (44 hours) -> Averages 38.5h
    },
  },
  {
    id: 'oluwaseun',
    name: 'Oluwaseun',
    role: 'Carer',
    contractedHours: 44,
    shiftPreference: 'Mixed', // Works Day and Night
    staffRef: 'EIL-016',
    defaultPattern: {
      0: 'E/L', 3: 'N', 5: 'E/L', 6: 'N', // Week A
      7: 'N', 9: 'E/L', 10: 'N', 13: 'E-K', // Week B
    },
  },
  // Activities
  {
    id: 'naim',
    name: 'Naim',
    role: 'Activities',
    contractedHours: 40,
    shiftPreference: 'Day',
    staffRef: 'EIL-018',
    defaultPattern: {
      0: '8/5.30', 1: '8/5.30', 2: '8/5.30', 3: '8/5.30', 4: '8/5.30',
      7: '8/5.30', 8: '8/5.30', 9: '8/5.30', 10: '8/5.30', 11: '8/5.30',
    },
  },
  // Kitchen
  {
    id: 'elena-cost',
    name: 'Elena Cost',
    role: 'Kitchen',
    contractedHours: 45,
    shiftPreference: 'Day',
    staffRef: 'EIL-019',
    defaultPattern: {
      0: '8/5.3', 1: '8/5.3', 2: '8/5.3', 3: '8/5.3', 4: '8/5.3',
      7: '8/5.3', 8: '8/5.3', 9: '8/5.3', 10: '8/5.3', 11: '8/5.3',
    },
  },
  {
    id: 'nathan',
    name: 'Nathan',
    role: 'Kitchen',
    contractedHours: 30,
    shiftPreference: 'Day',
    staffRef: 'EIL-020',
    defaultPattern: {},
  },
  // Domestic / Laundry
  {
    id: 'hollie',
    name: 'Hollie',
    role: 'Domestic/Laundry',
    contractedHours: 30,
    shiftPreference: 'Day',
    staffRef: 'EIL-021',
    defaultPattern: {
      0: '12/6', 1: '12/6', 2: '12/6', 3: '12/6', 4: '12/6',
      7: '12/6', 8: '12/6', 9: '12/6', 10: '12/6', 11: '12/6',
    },
  },
  {
    id: 'katrina-fu',
    name: 'Katrina Fu',
    role: 'Domestic/Laundry',
    contractedHours: 27.5,
    shiftPreference: 'Day',
    staffRef: 'EIL-022',
    defaultPattern: {
      0: '8/2', 1: '8/2', 2: '8/2', 3: '8/2', 4: '8/2',
      7: '8/2', 8: '8/2', 9: '8/2', 10: '8/2', 11: '8/2',
    },
  },
  {
    id: 'daberechi',
    name: 'Daberechi',
    role: 'Domestic/Laundry',
    contractedHours: 27.5,
    shiftPreference: 'Day',
    staffRef: 'EIL-023',
    defaultPattern: {
      0: '8/2', 1: '8/2', 2: '8/2', 3: '8/2', 4: '8/2', 5: '8/2', 6: '8/2', // Week A (38.5 hours)
      7: '8/2', 8: '8/2', 9: '8/2', 10: '8/2', 11: '8/2', // Week B (27.5 hours - Mon-Fri) -> Averages 33h overall
    },
  },
];
