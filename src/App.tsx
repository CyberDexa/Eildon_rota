import React, { useState, useMemo } from 'react';
import type { Staff, Holiday, RotaShift } from './types';
import { INITIAL_STAFF } from './data/initialData';
import { generateRota } from './utils/rotaEngine';
import { Dashboard } from './components/Dashboard';

const App: React.FC = () => {
  // Staff Directory state
  const [staffList, setStaffList] = useState<Staff[]>(INITIAL_STAFF);

  // Holidays state
  // We'll pre-populate two holidays so the user can immediately observe the automatic coverage system in action
  const [holidays, setHolidays] = useState<Holiday[]>([
    {
      id: 'h-1',
      staffId: 'jahanvi-bh', // Staff Nurse
      startDate: '2026-07-22', // Wed
      endDate: '2026-07-24', // Fri
    },
    {
      id: 'h-2',
      staffId: 'becky-ovu', // Carer
      startDate: '2026-07-21', // Tue
      endDate: '2026-07-23', // Thu
    },
  ]);

  // Manual Overrides state: date -> staffId -> RotaShift
  const [manualOverrides, setManualOverrides] = useState<Record<string, Record<string, RotaShift>>>({});

  // Recalculate Rota and Covers reactively whenever state changes
  const { rota, covers } = useMemo(() => {
    return generateRota(staffList, holidays, manualOverrides);
  }, [staffList, holidays, manualOverrides]);

  // Holiday handlers
  const handleAddHoliday = (newHoliday: Omit<Holiday, 'id'>) => {
    const id = `h-${Date.now()}`;
    setHolidays((prev) => [...prev, { ...newHoliday, id }]);
  };

  const handleRemoveHoliday = (id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  // Staff handlers
  const handleAddStaff = (newStaff: Omit<Staff, 'id'>) => {
    const id = newStaff.name.toLowerCase().replace(/[\s\W]+/g, '-');
    setStaffList((prev) => [...prev, { ...newStaff, id }]);
  };

  const handleRemoveStaff = (id: string) => {
    setStaffList((prev) => prev.filter((s) => s.id !== id));
  };

  // Override handlers
  const handleApplyOverride = (date: string, staffId: string, override: RotaShift | null) => {
    setManualOverrides((prev) => {
      const copy = { ...prev };
      if (!copy[date]) copy[date] = {};

      if (override === null) {
        // Remove override to reset to default
        delete copy[date][staffId];
        if (Object.keys(copy[date]).length === 0) {
          delete copy[date];
        }
      } else {
        // Apply custom override
        copy[date][staffId] = override;
      }
      return copy;
    });
  };

  const handleResetOverrides = () => {
    setManualOverrides({});
  };

  return (
    <Dashboard
      staffList={staffList}
      holidays={holidays}
      covers={covers}
      rota={rota}
      onAddHoliday={handleAddHoliday}
      onRemoveHoliday={handleRemoveHoliday}
      onAddStaff={handleAddStaff}
      onRemoveStaff={handleRemoveStaff}
      onApplyOverride={handleApplyOverride}
      onResetOverrides={handleResetOverrides}
    />
  );
};

export default App;
