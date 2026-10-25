import type { Staff, Holiday, RotaShift, User } from './types';

const BASE = '/api';
const TOKEN_KEY = 'eildon_auth_token';

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const setStoredToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearStoredToken = () => localStorage.removeItem(TOKEN_KEY);

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json() as { token?: string; user?: User; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Login failed');
  setStoredToken(data.token!);
  return { token: data.token!, user: data.user! };
}

export const getMe = () => request<User>('/auth/me');
export const getUsers = () => request<(User & { created_at: string })[]>('/auth/users');
export const createUser = (username: string, password: string, role: 'manager' | 'user') =>
  request<User & { created_at: string }>('/auth/users', {
    method: 'POST',
    body: JSON.stringify({ username, password, role }),
  });
export const deleteUser = (id: string) =>
  request<{ success: boolean }>(`/auth/users/${id}`, { method: 'DELETE' });
export const changePassword = (userId: string, newPassword: string) =>
  request<{ success: boolean }>(`/auth/users/${userId}/password`, {
    method: 'PUT',
    body: JSON.stringify({ newPassword }),
  });

// ─── Staff ────────────────────────────────────────────────────────────────────

export const fetchStaff = () => request<Staff[]>('/staff');
export const createStaff = (staff: Staff) =>
  request<Staff>('/staff', { method: 'POST', body: JSON.stringify(staff) });
export const updateStaff = (id: string, updates: Partial<Omit<Staff, 'id'>>) =>
  request<Staff>(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
export const deleteStaff = (id: string) =>
  request<{ success: boolean }>(`/staff/${id}`, { method: 'DELETE' });

// ─── Holidays ─────────────────────────────────────────────────────────────────

export const fetchHolidays = () => request<Holiday[]>('/holidays');
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
export const resetOverridesForDateRange = (startDate: string, endDate: string) =>
  request<{ success: boolean }>('/overrides/week', {
    method: 'DELETE',
    body: JSON.stringify({ startDate, endDate }),
  });

