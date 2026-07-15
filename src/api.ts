import type { Staff, Holiday, RotaShift } from './types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export const fetchStaff = () =>
  request<Staff[]>('/staff');

export const createStaff = (staff: Staff) =>
  request<Staff>('/staff', { method: 'POST', body: JSON.stringify(staff) });

export const updateStaff = (id: string, updates: Partial<Omit<Staff, 'id'>>) =>
  request<Staff>(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(updates) });

export const deleteStaff = (id: string) =>
  request<{ success: boolean }>(`/staff/${id}`, { method: 'DELETE' });

// ─── Holidays ─────────────────────────────────────────────────────────────────

export const fetchHolidays = () =>
  request<Holiday[]>('/holidays');

export const createHoliday = (holiday: Holiday) =>
  request<Holiday>('/holidays', { method: 'POST', body: JSON.stringify(holiday) });

export const deleteHoliday = (id: string) =>
  request<{ success: boolean }>(`/holidays/${id}`, { method: 'DELETE' });

// ─── Overrides ────────────────────────────────────────────────────────────────

export const fetchOverrides = () =>
  request<Record<string, Record<string, RotaShift>>>('/overrides');

export const upsertOverride = (date: string, staffId: string, shift: RotaShift) =>
  request<{ success: boolean }>('/overrides', {
    method: 'PUT',
    body: JSON.stringify({ date, staffId, shift }),
  });

export const deleteOverride = (date: string, staffId: string) =>
  request<{ success: boolean }>('/overrides/single', {
    method: 'DELETE',
    body: JSON.stringify({ date, staffId }),
  });

export const resetOverrides = () =>
  request<{ success: boolean }>('/overrides/all', { method: 'DELETE' });
