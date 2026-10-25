import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Staff, Holiday, RotaShift, User } from './types';
import { generateRota, getMondayStartDate } from './utils/rotaEngine';
import { Dashboard } from './components/Dashboard';
import LoginPage from './components/LoginPage';
import * as api from './api';

const ROTA_PATTERN_ANCHOR = '2026-08-10';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [manualOverrides, setManualOverrides] = useState<Record<string, Record<string, RotaShift>>>({});
  const [loading, setLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [rotaGenerationKey, setRotaGenerationKey] = useState(0);
  const [reshuffleRange, setReshuffleRange] = useState<{ startDate: string; endDate: string } | null>(null);

  // Rota start date — drives which 28 days are generated
  const [rotaStartDate, setRotaStartDate] = useState(() => getMondayStartDate());

  // On mount: check for stored JWT and validate it
  useEffect(() => {
    const checkAuth = async () => {
      const token = api.getStoredToken();
      if (!token) { setAuthChecked(true); return; }
      try {
        const user = await api.getMe();
        setCurrentUser(user);
      } catch {
        api.clearStoredToken();
      } finally {
        setAuthChecked(true);
      }
    };
    checkAuth();
  }, []);

  // Load rota data once the user is authenticated
  useEffect(() => {
    if (!currentUser) return;
    const loadAll = async () => {
      setLoading(true);
      try {
        const [staff, holidayList, overrides] = await Promise.all([
          api.fetchStaff(),
          api.fetchHolidays(),
          api.fetchOverrides(),
        ]);
        setStaffList(staff);
        setHolidays(holidayList);
        setManualOverrides(overrides);
      } catch (err) {
        console.error('Failed to load data:', err);
        setDbError('Could not connect to the database. Is the API server running?');
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [currentUser]);

  // Rota is computed reactively from the three data sources
  const { rota, covers, coverOptions } = useMemo(() => {
    const base = generateRota(staffList, holidays, manualOverrides, rotaStartDate, 28, ROTA_PATTERN_ANCHOR);
    if (!reshuffleRange || rotaGenerationKey === 0) return base;

    const reshuffled = generateRota(
      staffList, holidays, manualOverrides, rotaStartDate, 28, ROTA_PATTERN_ANCHOR,
      rotaGenerationKey, reshuffleRange
    );
    const inReshuffledWeek = (date: string) => date >= reshuffleRange.startDate && date < reshuffleRange.endDate;
    const weekRota = new Map(reshuffled.rota.filter((day) => inReshuffledWeek(day.date)).map((day) => [day.date, day]));
    const weekCoverOptions = Object.fromEntries(
      Object.entries(reshuffled.coverOptions).filter(([key]) => inReshuffledWeek(key.slice(0, 10)))
    );
    return {
      rota: base.rota.map((day) => weekRota.get(day.date) ?? day),
      covers: [
        ...base.covers.filter((cover) => !inReshuffledWeek(cover.date)),
        ...reshuffled.covers.filter((cover) => inReshuffledWeek(cover.date)),
      ],
      coverOptions: {
        ...Object.fromEntries(Object.entries(base.coverOptions).filter(([key]) => !inReshuffledWeek(key.slice(0, 10)))),
        ...weekCoverOptions,
      },
    };
  }, [staffList, holidays, manualOverrides, rotaStartDate, rotaGenerationKey, reshuffleRange]);

  // ─── Holiday handlers ─────────────────────────────────────────────────────

  const handleAddHoliday = useCallback(async (newHoliday: Omit<Holiday, 'id'>) => {
    const holiday: Holiday = { ...newHoliday, id: `h-${Date.now()}` };
    setHolidays((prev) => [...prev, holiday]);
    try {
      await api.createHoliday(holiday);
    } catch {
      setHolidays((prev) => prev.filter((h) => h.id !== holiday.id));
      alert('Failed to save holiday. Please try again.');
    }
  }, []);

  const handleRemoveHoliday = useCallback(async (id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    try {
      await api.deleteHoliday(id);
    } catch {
      alert('Failed to remove holiday. Please refresh the page.');
    }
  }, []);

  // ─── Staff handlers ───────────────────────────────────────────────────────

  const handleAddStaff = useCallback(async (newStaff: Omit<Staff, 'id'>) => {
    const id = newStaff.name.toLowerCase().replace(/[\s\W]+/g, '-');
    const staff: Staff = { ...newStaff, id };
    setStaffList((prev) => [...prev, staff]);
    try {
      const saved = await api.createStaff(staff);
      setStaffList((prev) => prev.map((s) => (s.id === id ? saved : s)));
    } catch {
      setStaffList((prev) => prev.filter((s) => s.id !== id));
      alert('Failed to save staff member. Please try again.');
    }
  }, []);

  const handleRemoveStaff = useCallback(async (id: string) => {
    setStaffList((prev) => prev.filter((s) => s.id !== id));
    try {
      await api.deleteStaff(id);
    } catch {
      alert('Failed to remove staff member. Please refresh the page.');
    }
  }, []);

  const handleUpdateStaff = useCallback(async (id: string, updates: Partial<Omit<Staff, 'id'>>) => {
    setStaffList((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    try {
      await api.updateStaff(id, updates);
    } catch {
      alert('Failed to update staff member. Please refresh the page.');
    }
  }, []);

  // ─── Override handlers ────────────────────────────────────────────────────

  const handleApplyOverride = useCallback(
    async (date: string, staffId: string, override: RotaShift | null) => {
      setManualOverrides((prev) => {
        const copy = { ...prev };
        if (!copy[date]) copy[date] = {};
        if (override === null) {
          delete copy[date][staffId];
          if (Object.keys(copy[date]).length === 0) delete copy[date];
        } else {
          copy[date][staffId] = override;
        }
        return copy;
      });
      try {
        if (override === null) {
          await api.deleteOverride(date, staffId);
        } else {
          await api.upsertOverride(date, staffId, override);
        }
      } catch {
        alert('Failed to save shift override. Please refresh the page.');
      }
    },
    []
  );


  const handleRebuildWeek = useCallback((startDate: string, endDate: string) => {
    const nextGenerationKey = rotaGenerationKey + 1;
    const currentRota = generateRota(staffList, holidays, manualOverrides, rotaStartDate, 28, ROTA_PATTERN_ANCHOR);
    const rebuiltRota = generateRota(
      staffList, holidays, manualOverrides, rotaStartDate, 28, ROTA_PATTERN_ANCHOR,
      nextGenerationKey, { startDate, endDate }
    );

    rebuiltRota.rota
      .filter((day) => day.date >= startDate && day.date < endDate)
      .forEach((day) => {
        const previousDay = currentRota.rota.find((previous) => previous.date === day.date);
        Object.entries(day.shifts).forEach(([originalStaffId, shift]) => {
          if (!shift.isCover || !shift.originalStaffId || shift.coverReason !== 'Holiday') return;
          if (manualOverrides[day.date]?.[originalStaffId]) return;
          if (previousDay?.shifts[originalStaffId]?.staffId === shift.staffId) return;
          void handleApplyOverride(day.date, originalStaffId, { ...shift, isManualOverride: true });
        });
      });

    setReshuffleRange({ startDate, endDate });
    setRotaGenerationKey(nextGenerationKey);
  }, [rotaGenerationKey, staffList, holidays, manualOverrides, rotaStartDate, handleApplyOverride]);
  const handleResetOverrides = useCallback(async (startDate: string, endDate: string) => {
    try {
      await api.resetOverridesForDateRange(startDate, endDate);
      setManualOverrides((prev) => Object.fromEntries(
        Object.entries(prev).filter(([date]) => date < startDate || date >= endDate)
      ));
    } catch {
      alert('Failed to reset this week. Please try again.');
    }
  }, []);

  const handleRotaStartDateChange = useCallback((date: string) => {
    setRotaStartDate(date);
  }, []);

  const handleLogin = useCallback((user: User) => {
    setCurrentUser(user);
  }, []);

  const handleLogout = useCallback(() => {
    api.clearStoredToken();
    setCurrentUser(null);
    setStaffList([]);
    setHolidays([]);
    setManualOverrides({});
  }, []);

  // ─── Loading / error screens ──────────────────────────────────────────────

  // Auth not checked yet — show nothing (avoids flash)
  if (!authChecked) return null;

  // Not logged in — show login page
  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  if (loading) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:'1rem', fontFamily:'Outfit,sans-serif' }}>
        <div style={{ width:'3rem', height:'3rem', borderRadius:'12px', background:'linear-gradient(135deg,#6366f1,#0284c7)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:'1.5rem' }}>E</div>
        <p style={{ color:'#475569', fontSize:'0.9rem' }}>Loading rota data…</p>
      </div>
    );
  }

  if (dbError) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:'1rem', fontFamily:'Outfit,sans-serif' }}>
        <p style={{ color:'#dc2626', fontWeight:600, maxWidth:'400px', textAlign:'center' }}>{dbError}</p>
        <button onClick={() => window.location.reload()} style={{ padding:'0.5rem 1.5rem', background:'#6366f1', color:'white', border:'none', borderRadius:'8px', fontWeight:600, cursor:'pointer' }}>Retry</button>
      </div>
    );
  }

  return (
    <Dashboard
      staffList={staffList}
      holidays={holidays}
      covers={covers}
      coverOptions={coverOptions}
      rota={rota}
      onAddHoliday={handleAddHoliday}
      onRemoveHoliday={handleRemoveHoliday}
      onAddStaff={handleAddStaff}
      onRemoveStaff={handleRemoveStaff}
      onUpdateStaff={handleUpdateStaff}
      onApplyOverride={handleApplyOverride}
      onResetOverrides={handleResetOverrides}
      onRebuildWeek={handleRebuildWeek}
      manualOverrides={manualOverrides}
      currentUser={currentUser}
      onLogout={handleLogout}
      rotaStartDate={rotaStartDate}
      onRotaStartDateChange={handleRotaStartDateChange}
    />
  );
};

export default App;
