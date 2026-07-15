import React, { useState } from 'react';
import type { Staff, Holiday, DayRota, RotaShift, CoverRecord, Role } from '../types';

interface DashboardProps {
  staffList: Staff[];
  holidays: Holiday[];
  covers: CoverRecord[];
  rota: DayRota[];
  onAddHoliday: (holiday: Omit<Holiday, 'id'>) => void;
  onRemoveHoliday: (id: string) => void;
  onAddStaff: (staff: Omit<Staff, 'id'>) => void;
  onRemoveStaff: (id: string) => void;
  onApplyOverride: (date: string, staffId: string, override: RotaShift | null) => void;
  onResetOverrides: () => void;
  onUpdateStaff: (id: string, updates: Partial<Omit<Staff, 'id'>>) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  staffList,
  holidays,
  covers,
  rota,
  onAddHoliday,
  onRemoveHoliday,
  onAddStaff,
  onRemoveStaff,
  onApplyOverride,
  onResetOverrides,
  onUpdateStaff,
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'rota' | 'staff' | 'holidays' | 'stats'>('rota');
  
  // Rota Week Selector (0 to 3)
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  
  // Modal for cell override editing
  const [editingCell, setEditingCell] = useState<{
    date: string;
    staffId: string;
    currentShift: RotaShift | undefined;
  } | null>(null);

  // Modal for adding staff
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);

  // Rota Filter by Role
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Form states - Holiday
  const [holidayStaffId, setHolidayStaffId] = useState('');
  const [holidayStart, setHolidayStart] = useState('2026-07-20');
  const [holidayEnd, setHolidayEnd] = useState('2026-07-26');

  // Form states - Staff
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<Role>('Carer');
  const [newStaffHours, setNewStaffHours] = useState(44);
  const [newStaffPreference, setNewStaffPreference] = useState<'Day' | 'Night' | 'Mixed'>('Mixed');
  const [newStaffPattern, setNewStaffPattern] = useState<Record<number, string>>({
    0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '',
    7: '', 8: '', 9: '', 10: '', 11: '', 12: '', 13: ''
  });
  const [newStaffLeaderQualified, setNewStaffLeaderQualified] = useState(false);
  const [newStaffKitchenQualified, setNewStaffKitchenQualified] = useState(false);
  const [newStaffRef, setNewStaffRef] = useState('');

  // Inline editing state for Staff Manager table
  const [editingStaffRef, setEditingStaffRef] = useState<{ id: string; value: string } | null>(null);

  // Date ranges for weeks
  const weekStartDates = ['2026-07-20', '2026-07-27', '2026-08-03', '2026-08-10'];
  const weekLabel = (weekIndex: number) => {
    const start = new Date(weekStartDates[weekIndex]);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const format = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `Week ${weekIndex + 1} (${format(start)} - ${format(end)})`;
  };

  // Filtered rota days for the selected week
  const currentWeekDays = rota.slice(selectedWeek * 7, (selectedWeek + 1) * 7);

  // Group staff by Role for rendering order
  const rolesOrder: Role[] = [
    'Manager',
    'Staff Nurse',
    'Shift Leader',
    'Carer',
    'Activities',
    'Kitchen',
    'Domestic/Laundry',
    'Bank'
  ];

  const sortedStaffList = [...staffList].sort((a, b) => {
    const roleDiff = rolesOrder.indexOf(a.role) - rolesOrder.indexOf(b.role);
    if (roleDiff !== 0) return roleDiff;
    return a.name.localeCompare(b.name);
  });

  const filteredStaffList = sortedStaffList.filter(
    (s) => roleFilter === 'ALL' || s.role === roleFilter
  );

  // Shift Cell Modal Handlers
  const handleCellClick = (date: string, staffId: string, shift: RotaShift | undefined) => {
    setEditingCell({ date, staffId, currentShift: shift });
  };

  const handleApplyOverride = (overrideShiftLabel: string) => {
    if (!editingCell) return;
    if (overrideShiftLabel === 'DEFAULT') {
      onApplyOverride(editingCell.date, editingCell.staffId, null);
    } else {
      const isOff = overrideShiftLabel === 'Off';
      onApplyOverride(editingCell.date, editingCell.staffId, {
        staffId: isOff ? '' : editingCell.staffId,
        shiftLabel: isOff ? '' : overrideShiftLabel,
        isCover: false,
        isManualOverride: true,
      });
    }
    setEditingCell(null);
  };

  const handleApplyManualCover = (coverStaffId: string) => {
    if (!editingCell || !editingCell.currentShift) return;
    
    if (coverStaffId === 'SHORTAGE') {
      onApplyOverride(editingCell.date, editingCell.staffId, {
        staffId: '',
        shiftLabel: editingCell.currentShift.shiftLabel,
        isCover: true,
        coverReason: 'Shortage',
        originalStaffId: editingCell.staffId,
        isManualOverride: true,
      });
    } else {
      onApplyOverride(editingCell.date, editingCell.staffId, {
        staffId: coverStaffId,
        shiftLabel: editingCell.currentShift.shiftLabel,
        isCover: true,
        coverReason: 'Holiday',
        originalStaffId: editingCell.staffId,
        isManualOverride: true,
      });
    }
    setEditingCell(null);
  };

  // Add staff handler
  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    onAddStaff({
      name: newStaffName,
      role: newStaffRole,
      contractedHours: newStaffHours,
      defaultPattern: newStaffPattern,
      isQualifiedForShiftLeader: newStaffLeaderQualified,
      isQualifiedForKitchen: newStaffKitchenQualified,
      shiftPreference: newStaffPreference,
      staffRef: newStaffRef.trim() || undefined,
    });
    setNewStaffName('');
    setNewStaffRef('');
    setNewStaffPreference('Mixed');
    setNewStaffPattern({
      0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '',
      7: '', 8: '', 9: '', 10: '', 11: '', 12: '', 13: ''
    });
    setShowAddStaffModal(false);
  };

  // Add holiday handler
  const handleAddHolidaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayStaffId) return;
    onAddHoliday({
      staffId: holidayStaffId,
      startDate: holidayStart,
      endDate: holidayEnd,
    });
  };

  // Staff Manager inline editing handlers
  const handleSaveStaffRef = (staffId: string) => {
    if (!editingStaffRef || editingStaffRef.id !== staffId) return;
    onUpdateStaff(staffId, { staffRef: editingStaffRef.value.trim() || undefined });
    setEditingStaffRef(null);
  };

  const handleToggleQualification = (
    staffId: string,
    qual: 'isQualifiedForShiftLeader' | 'isQualifiedForKitchen',
    currentValue: boolean
  ) => {
    onUpdateStaff(staffId, { [qual]: !currentValue });
  };

  // Statistics calculations
  const totalHolidays = holidays.length;
  const totalCovers = covers.length;
  const unresolvedVacancies = rota.reduce((acc, day) => {
    const vacantCount = Object.values(day.shifts).filter(
      (s) => s.isCover && s.coverReason === 'Shortage'
    ).length;
    return acc + vacantCount;
  }, 0);

  // Calculate cover/extra shifts worked per staff member
  const coverStats = staffList.map((staff) => {
    const extraCount = covers.filter((c) => c.coverStaffId === staff.id).length;
    const lastCoverRecord = [...covers]
      .filter((c) => c.coverStaffId === staff.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return {
      staff,
      count: extraCount,
      lastDate: lastCoverRecord ? lastCoverRecord.date : 'Never',
    };
  }).sort((a, b) => b.count - a.count || a.staff.name.localeCompare(b.staff.name));

  return (
    <div className="app-container">
      {/* Navigation Navbar */}
      <nav className="app-navbar">
        <div className="brand-section">
          <div className="brand-logo">E</div>
          <div className="brand-title">
            <h1>Eildon Care Home</h1>
            <span>Staff Rota Automation Dashboard</span>
          </div>
        </div>
        <div className="nav-tabs">
          <button
            className={`tab-btn ${activeTab === 'rota' ? 'active' : ''}`}
            onClick={() => setActiveTab('rota')}
          >
            📅 Rota Board
          </button>
          <button
            className={`tab-btn ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            👥 Staff Manager
          </button>
          <button
            className={`tab-btn ${activeTab === 'holidays' ? 'active' : ''}`}
            onClick={() => setActiveTab('holidays')}
          >
            🏖️ Holiday Planner
          </button>
          <button
            className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            📊 Fair Rotation Stats
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="main-content">
        {/* Top Summary Info */}
        <div className="stats-grid">
          <div className="stat-box">
            <span className="stat-label">Total Staff</span>
            <span className="stat-val indigo">{staffList.length}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Active Holidays</span>
            <span className="stat-val warning">{totalHolidays}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Auto-covered Shifts</span>
            <span className="stat-val success">{totalCovers}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Shortages (Unresolved)</span>
            <span className="stat-val danger">{unresolvedVacancies}</span>
          </div>
        </div>

        {/* TAB 1: ROTA BOARD */}
        {activeTab === 'rota' && (
          <div className="glass-card">
            <div className="card-header-flex">
              <h2>4-Week Rota Grid</h2>
              <div className="controls-bar" style={{ margin: 0 }}>
                <select
                  className="select-control"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="ALL">All Roles</option>
                  {rolesOrder.map((r) => (
                    <option key={r} value={r}>
                      {r}s
                    </option>
                  ))}
                </select>
                <button className="btn btn-secondary" onClick={onResetOverrides}>
                  🔄 Reset Overrides
                </button>
              </div>
            </div>

            {/* Week Selector Subbar */}
            <div className="week-selector-bar">
              <div className="week-btn-group">
                {[0, 1, 2, 3].map((weekIndex) => (
                  <button
                    key={weekIndex}
                    className={`week-btn ${selectedWeek === weekIndex ? 'active' : ''}`}
                    onClick={() => setSelectedWeek(weekIndex)}
                  >
                    {weekLabel(weekIndex)}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid Table */}
            <div className="rota-grid-wrapper">
              <table className="rota-table">
                <thead>
                  <tr>
                    <th className="staff-col">Staff Member (Hrs)</th>
                    {currentWeekDays.map((day) => {
                      const dateObj = new Date(day.date);
                      const formattedDate = dateObj.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'numeric',
                        day: 'numeric',
                      });
                      return <th key={day.date}>{formattedDate}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredStaffList.map((staff) => (
                    <tr key={staff.id}>
                      <td className="staff-col">
                        {staff.name}
                        <span className="staff-role-badge">
                          {staff.role} • {staff.contractedHours}h
                        </span>
                      </td>
                      {currentWeekDays.map((day) => {
                        const shift = day.shifts[staff.id];
                        const isHoliday = holidays.some((h) => {
                          if (h.staffId !== staff.id) return false;
                          const hStart = new Date(h.startDate).getTime();
                          const hEnd = new Date(h.endDate).getTime();
                          const dTime = new Date(day.date).getTime();
                          return dTime >= hStart && dTime <= hEnd;
                        });

                        // Determine render properties
                        let cellContent = '';
                        let cellClass = 'shift-empty';
                        let coverLabel = '';
                        let hoverTitle = 'Off / Scheduled Off';

                        if (shift) {
                          if (shift.isCover) {
                            if (shift.coverReason === 'Shortage') {
                              cellContent = 'SHORTAGE';
                              cellClass = 'shift-holiday-vacant';
                              hoverTitle = `Vacancy: ${shift.shiftLabel} (No cover available)`;
                            } else {
                              const coverStaff = staffList.find((s) => s.id === shift.staffId);
                              cellContent = shift.shiftLabel;
                              cellClass = `shift-${shift.shiftLabel.replace(/[\/\s]/g, '-')} shift-cover`;
                              coverLabel = coverStaff ? coverStaff.name : 'Cover';
                              hoverTitle = `Cover: ${coverLabel} working for ${staff.name}`;
                            }
                          } else if (shift.shiftLabel) {
                            cellContent = shift.shiftLabel;
                            cellClass = `shift-${shift.shiftLabel.replace(/[\/\s]/g, '-')}`;
                            hoverTitle = `${staff.name}: ${shift.shiftLabel}`;
                          }
                        }

                        if (isHoliday && (!shift || !shift.isCover)) {
                          cellContent = 'HOLIDAY';
                          cellClass = 'shift-holiday-indicator';
                          hoverTitle = `${staff.name} is on Holiday`;
                        }

                        return (
                          <td key={day.date} title={hoverTitle}>
                            <div
                              className={`shift-cell-inner ${cellClass}`}
                              onClick={() => handleCellClick(day.date, staff.id, shift)}
                            >
                              {cellContent || '-'}
                              {coverLabel && (
                                <span className="shift-cover-original">{coverLabel}</span>
                              )}
                              {shift?.isCover && shift.coverReason !== 'Shortage' && (
                                <span className="shift-cover-badge">C</span>
                              )}
                              {shift?.isManualOverride && (
                                <span className="shift-cover-badge" style={{ background: '#f59e0b', right: '10px' }}>
                                  M
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend and Compliance Tracker */}
            <div className="legend-container">
              <div className="legend-item">
                <div className="legend-color shift-E-L"></div>
                <span>Day Shift (E/L, M/L)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color shift-N"></div>
                <span>Night Shift (N)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color shift-7-5"></div>
                <span>Management / Activities</span>
              </div>
              <div className="legend-item">
                <div className="legend-color shift-8-5-3"></div>
                <span>Kitchen / Catering</span>
              </div>
              <div className="legend-item">
                <div className="legend-color shift-12-6"></div>
                <span>Domestic / Laundry</span>
              </div>
              <div className="legend-item">
                <div className="legend-color shift-holiday-indicator"></div>
                <span>Staff on Holiday</span>
              </div>
              <div className="legend-item">
                <div className="legend-color shift-holiday-vacant"></div>
                <span>Shortage (Unfilled Cover)</span>
              </div>
            </div>

            {/* Weekly Staffing Levels Compliance Section */}
            <div className="staffing-summary-section">
              <h3>Minimum Floor Staffing Compliance</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Required Floor Staff: Earlies (4), Lates (4), Nights (3)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                {currentWeekDays.map((day) => {
                  const eS = day.staffingStatus.scheduled.Earlies;
                  const lS = day.staffingStatus.scheduled.Lates;
                  const nS = day.staffingStatus.scheduled.Nights;

                  const isCompliant = eS >= 4 && lS >= 4 && nS >= 3;
                  const dObj = new Date(day.date);
                  const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short' });

                  return (
                    <div
                      key={day.date}
                      className={`stat-box ${
                        isCompliant ? 'status-good' : eS === 0 ? 'status-danger' : 'status-warning'
                      }`}
                      style={{ padding: '0.75rem', gap: '0.25rem' }}
                    >
                      <strong style={{ fontSize: '0.8rem' }}>{dayName}</strong>
                      <div style={{ fontSize: '0.7rem', display: 'flex', flexDirection: 'column' }}>
                        <span>🌅 E: {eS}/4</span>
                        <span>🌆 L: {lS}/4</span>
                        <span>🌃 N: {nS}/3</span>
                      </div>
                      <span
                        className={`status-indicator ${
                          isCompliant ? 'status-indicator-green' : 'status-indicator-red'
                        }`}
                        style={{ marginTop: '0.25rem', alignSelf: 'flex-start' }}
                      >
                        {isCompliant ? '✓ OK' : '⚠ SHORT'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STAFF MANAGER */}
        {activeTab === 'staff' && (
          <div className="split-layout">
            <div className="glass-card">
              <div className="card-header-flex">
                <h2>Roster Directory</h2>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddStaffModal(true)}
                >
                  ➕ Add Staff Member
                </button>
              </div>

              <table className="table-simple">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Ref #</th>
                    <th>Role</th>
                    <th>Contract Hours</th>
                    <th>Shift Preference</th>
                    <th>Special Qualifications</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStaffList.map((staff) => (
                    <tr key={staff.id}>
                      <td style={{ fontWeight: 600 }}>{staff.name}</td>
                      <td>
                        {editingStaffRef?.id === staff.id ? (
                          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="input-control"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', width: '90px' }}
                              value={editingStaffRef.value}
                              onChange={(e) => setEditingStaffRef({ id: staff.id, value: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveStaffRef(staff.id);
                                if (e.key === 'Escape') setEditingStaffRef(null);
                              }}
                              autoFocus
                            />
                            <button
                              className="btn btn-primary"
                              style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                              onClick={() => handleSaveStaffRef(staff.id)}
                            >✓</button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                              onClick={() => setEditingStaffRef(null)}
                            >✕</button>
                          </div>
                        ) : (
                          <button
                            title="Click to edit reference"
                            onClick={() => setEditingStaffRef({ id: staff.id, value: staff.staffRef || '' })}
                            className="staff-ref-btn"
                          >
                            {staff.staffRef || '—'}
                          </button>
                        )}
                      </td>
                      <td>{staff.role}</td>
                      <td>{staff.contractedHours} hours</td>
                      <td>
                        <span className={`status-indicator ${
                          staff.shiftPreference === 'Night' ? 'shift-N' :
                          staff.shiftPreference === 'Day' ? 'shift-E-L' : 'shift-7-5'
                        }`} style={{ border: '1px solid var(--border-color)', fontWeight: 'bold' }}>
                          {staff.shiftPreference || 'Mixed'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <label className="qual-checkbox-label">
                            <input
                              type="checkbox"
                              checked={!!staff.isQualifiedForShiftLeader}
                              onChange={() => handleToggleQualification(staff.id, 'isQualifiedForShiftLeader', !!staff.isQualifiedForShiftLeader)}
                            />
                            Shift Leader Cover
                          </label>
                          <label className="qual-checkbox-label">
                            <input
                              type="checkbox"
                              checked={!!staff.isQualifiedForKitchen}
                              onChange={() => handleToggleQualification(staff.id, 'isQualifiedForKitchen', !!staff.isQualifiedForKitchen)}
                            />
                            Kitchen Cover
                          </label>
                        </div>
                      </td>
                      <td>
                        {staff.role !== 'Manager' && (
                          <button
                            className="btn btn-danger"
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            onClick={() => onRemoveStaff(staff.id)}
                          >
                            🗑 Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sidebar info */}
            <div className="glass-card">
              <h3>Role Requirements</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.25rem' }}>
                <div>
                  <strong>Managers (1)</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Natasha T (40h): Administrative duties, Mon–Fri.
                  </p>
                </div>
                <div>
                  <strong>Staff Nurses (3)</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Requires continuous clinical coverage on E/L or M/L shifts.
                  </p>
                </div>
                <div>
                  <strong>Shift Leaders (3)</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Supervises care staff. Works E/L or Night patterns.
                  </p>
                </div>
                <div>
                  <strong>Carers (9)</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Provide hands-on care. Working E/L or N schedules.
                  </p>
                </div>
                <div>
                  <strong>Support Teams (5)</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Kitchen (Catering), Domestic & Laundry, Activities Organizers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: HOLIDAY PLANNER */}
        {activeTab === 'holidays' && (
          <div className="split-layout">
            <div className="glass-card">
              <h2>Active Staff Holidays</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                When a staff member goes on holiday, the system automatically detects shifts needing coverage and re-assigns them using the Fair Rotation Engine.
              </p>

              {holidays.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  🏝️ No holidays scheduled. Add one on the right to see auto-cover in action!
                </div>
              ) : (
                <table className="table-simple">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Role</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.map((h) => {
                      const staff = staffList.find((s) => s.id === h.staffId);
                      return (
                        <tr key={h.id}>
                          <td style={{ fontWeight: 600 }}>{staff ? staff.name : 'Unknown'}</td>
                          <td>{staff ? staff.role : '-'}</td>
                          <td>{new Date(h.startDate).toLocaleDateString()}</td>
                          <td>{new Date(h.endDate).toLocaleDateString()}</td>
                          <td>
                            <span className="status-indicator status-indicator-green">
                              Auto-Cover Active
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                              onClick={() => onRemoveHoliday(h.id)}
                            >
                              🗑 Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Add Holiday Form */}
            <div className="glass-card">
              <h3>Schedule Holiday</h3>
              <form onSubmit={handleAddHolidaySubmit} style={{ marginTop: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Staff Member</label>
                  <select
                    className="select-control"
                    value={holidayStaffId}
                    onChange={(e) => setHolidayStaffId(e.target.value)}
                    required
                  >
                    <option value="">Select Employee...</option>
                    {sortedStaffList
                      .filter((s) => s.role !== 'Bank')
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="input-control"
                    value={holidayStart}
                    onChange={(e) => setHolidayStart(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="input-control"
                    value={holidayEnd}
                    onChange={(e) => setHolidayEnd(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  🏖 Schedule Holiday & Fit Covers
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: STATS / FAIR COVERAGE */}
        {activeTab === 'stats' && (
          <div className="glass-card">
            <h2>Fair Rotation Cover Stats</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              To ensure fairness, the system assigns extra/cover shifts to employees with the <strong>least recently worked extra shifts</strong> (and lowest total extra shift counts).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <h3>Fair Rotation Tracker</h3>
                <p style={{ fontStyle: 'italic', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Sorted by: Most shifts covered (highest overtime) to least covered.
                </p>
                <table className="table-simple">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Role</th>
                      <th>Total Cover Shifts Worked</th>
                      <th>Last Covered Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverStats.map(({ staff, count, lastDate }) => (
                      <tr key={staff.id}>
                        <td style={{ fontWeight: 600 }}>{staff.name}</td>
                        <td>{staff.role}</td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontWeight: 'bold',
                              fontSize: '0.8rem',
                              background: count > 0 ? 'var(--primary-glow)' : 'rgba(255,255,255,0.03)',
                              color: count > 0 ? 'var(--accent)' : 'var(--text-muted)',
                              border: count > 0 ? '1px solid var(--accent)' : '1px solid var(--border-color)',
                            }}
                          >
                            {count} shifts
                          </span>
                        </td>
                        <td>{lastDate !== 'Never' ? new Date(lastDate).toLocaleDateString() : lastDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3>Coverage Assignment Logs</h3>
                <p style={{ fontStyle: 'italic', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Chronological log of automatically resolved holiday cover shifts.
                </p>

                {covers.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    📭 No cover transactions logged yet. Add holidays to trigger covers.
                  </div>
                ) : (
                  <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <table className="table-simple">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Covering Staff</th>
                          <th>Original Staff</th>
                          <th>Shift</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...covers]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((c) => {
                            const cov = staffList.find((s) => s.id === c.coverStaffId);
                            const orig = staffList.find((s) => s.id === c.originalStaffId);
                            return (
                              <tr key={c.id}>
                                <td>{new Date(c.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                                <td style={{ fontWeight: 'bold', color: 'var(--success)' }}>{cov ? cov.name : 'Unknown'}</td>
                                <td style={{ color: 'var(--text-secondary)' }}>{orig ? orig.name : 'Unknown'}</td>
                                <td>
                                  <span className={`status-indicator shift-${c.shiftLabel.replace(/[\/\s]/g, '-')}`}>
                                    {c.shiftLabel}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* OVERRIDE EDIT CELL MODAL */}
      {editingCell && (
        <div className="modal-overlay" onClick={() => setEditingCell(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Modify Shift</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              <strong>Employee:</strong> {staffList.find((s) => s.id === editingCell.staffId)?.name} <br />
              <strong>Date:</strong> {new Date(editingCell.date).toLocaleDateString()}
            </p>

            <div className="form-group">
              <label className="form-label">Set Shift Value / Status</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => handleApplyOverride('DEFAULT')}>
                  Standard Roster Default
                </button>
                <button className="btn btn-secondary" onClick={() => handleApplyOverride('E/L')}>
                  Day Shift (E/L)
                </button>
                <button className="btn btn-secondary" onClick={() => handleApplyOverride('N')}>
                  Night Shift (N)
                </button>
                <button className="btn btn-secondary" onClick={() => handleApplyOverride('Off')}>
                  Scheduled Off
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1.25rem' }}>
              <label className="form-label">Assign Manual Cover (Override Auto-Cover)</label>
              <select
                className="select-control"
                defaultValue=""
                onChange={(e) => handleApplyManualCover(e.target.value)}
              >
                <option value="" disabled>Select cover staff...</option>
                <option value="SHORTAGE">Mark as Shortage (Uncovered)</option>
                {staffList
                  .filter((s) => s.id !== editingCell.staffId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditingCell(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD STAFF MODAL */}
      {showAddStaffModal && (
        <div className="modal-overlay" onClick={() => setShowAddStaffModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3 className="modal-title">Add Staff Member</h3>
            <form onSubmit={handleAddStaffSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. John Doe"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="select-control"
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value as Role)}
                    required
                  >
                    {rolesOrder.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Shift Preference</label>
                  <select
                    className="select-control"
                    value={newStaffPreference}
                    onChange={(e) => setNewStaffPreference(e.target.value as any)}
                    required
                  >
                    <option value="Mixed">Mixed (Day & Night)</option>
                    <option value="Day">Day Shifts Only</option>
                    <option value="Night">Night Shifts Only</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Contracted Weekly Hours</label>
                  <input
                    type="number"
                    className="input-control"
                    value={newStaffHours}
                    onChange={(e) => setNewStaffHours(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Staff Reference</label>
                  <input
                    type="text"
                    className="input-control"
                    placeholder="e.g. EIL-042"
                    value={newStaffRef}
                    onChange={(e) => setNewStaffRef(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Special Qualifications</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                    <label className="qual-checkbox-label">
                      <input
                        type="checkbox"
                        checked={newStaffLeaderQualified}
                        onChange={(e) => setNewStaffLeaderQualified(e.target.checked)}
                      />
                      Shift Leader Cover
                    </label>
                    <label className="qual-checkbox-label">
                      <input
                        type="checkbox"
                        checked={newStaffKitchenQualified}
                        onChange={(e) => setNewStaffKitchenQualified(e.target.checked)}
                      />
                      Kitchen Cover
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">Default Shift Pattern - Week A (Days 1–7)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', marginTop: '0.25rem' }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{dayName}</span>
                      <select
                        className="select-control"
                        style={{ padding: '0.25rem', fontSize: '0.75rem', width: '100%' }}
                        value={newStaffPattern[idx] || ''}
                        onChange={(e) => {
                          setNewStaffPattern({
                            ...newStaffPattern,
                            [idx]: e.target.value,
                          });
                        }}
                      >
                        <option value="">Off</option>
                        <option value="E/L">E/L</option>
                        <option value="M/L">M/L</option>
                        <option value="N">N</option>
                        <option value="7/5">7/5</option>
                        <option value="8/5.30">8/5.30</option>
                        <option value="8/5.3">8/5.3</option>
                        <option value="E/L - K">E/L-K</option>
                        <option value="12/6">12/6</option>
                        <option value="8/2">8/2</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">Default Shift Pattern - Week B (Days 8–14)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', marginTop: '0.25rem' }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, idx) => {
                    const offsetIdx = idx + 7;
                    return (
                      <div key={offsetIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{dayName}</span>
                        <select
                          className="select-control"
                          style={{ padding: '0.25rem', fontSize: '0.75rem', width: '100%' }}
                          value={newStaffPattern[offsetIdx] || ''}
                          onChange={(e) => {
                            setNewStaffPattern({
                              ...newStaffPattern,
                              [offsetIdx]: e.target.value,
                            });
                          }}
                        >
                          <option value="">Off</option>
                          <option value="E/L">E/L</option>
                          <option value="M/L">M/L</option>
                          <option value="N">N</option>
                          <option value="7/5">7/5</option>
                          <option value="8/5.30">8/5.30</option>
                          <option value="8/5.3">8/5.3</option>
                          <option value="E/L - K">E/L-K</option>
                          <option value="12/6">12/6</option>
                          <option value="8/2">8/2</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddStaffModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  💾 Save Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
