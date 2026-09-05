// Thin API client for the Rockota FastAPI backend.
// Override the base URL with VITE_API_URL in a .env file if the backend
// runs somewhere other than http://localhost:8000.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export async function loginRequest(email: string, password: string): Promise<string> {
  // FastAPI's OAuth2 password flow expects form-encoded `username`/`password`.
  const body = new URLSearchParams();
  body.append('username', email);
  body.append('password', password);

  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? 'Login failed. Check your email and password.');
  }

  const data = await res.json();
  return data.access_token as string;
}

export async function fetchMe(token: string): Promise<User> {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Session expired');
  return (await res.json()) as User;
}

// --- Utils / data ------------------------------------------------------------
export interface UtilView {
  id: string;
  name: string;
}

export interface UtilReport {
  id: string;
  name: string;
}

export interface UtilSource {
  name: string;
  url: string;
}

export interface UtilManifest {
  id: string;
  name: string;
  source?: string;
  sources?: UtilSource[];
  description?: string;
  credentials?: string[];
  views?: UtilView[];
  reports?: UtilReport[];
  params?: Record<string, unknown>;
  /** Named sections for the wide-table (Data) view: group name -> table codes. */
  table_groups?: { name: string; codes: string[] }[];
}

export interface Series {
  id: number;
  util_id: string | null;
  code: string;
  title: string | null;
  source: string | null;
  unit: string | null;
  frequency: string | null;
  geography: string | null;
  dataset: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface Observation {
  id: number;
  series_id: number;
  series_code: string;
  series_title: string;
  unit: string | null;
  obs_date: string;
  period_label: string | null;
  value: number | null;
  geography: string | null;
  obs_type: string | null;
}

export interface ObservationFilters {
  seriesIds?: number[];
  dateFrom?: string;
  dateTo?: string;
  geography?: string;
  /** Page size for the table view. Omit for the full set (export). */
  limit?: number;
  /** Row offset for pagination (used with limit). */
  offset?: number;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function getJson<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders(token) });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function listUtils(token: string): Promise<UtilManifest[]> {
  return getJson<UtilManifest[]>('/api/utils', token);
}

export function getUtil(token: string, id: string): Promise<UtilManifest> {
  return getJson<UtilManifest>(`/api/utils/${id}`, token);
}

export function listSeries(token: string, utilId: string): Promise<Series[]> {
  return getJson<Series[]>(`/api/series?util=${encodeURIComponent(utilId)}`, token);
}

// --- Wide/multi-column tables ---
export interface TableColumn { key: string; label?: string }
export interface DataTableMeta { id: number; util_id: string; code: string; title?: string; n_columns: number; n_rows: number }
export interface DataTable { util_id: string; code: string; title?: string; columns: TableColumn[]; rows: Record<string, unknown>[] }

export function listTables(token: string, utilId: string): Promise<DataTableMeta[]> {
  return getJson<DataTableMeta[]>(`/api/tables?util=${encodeURIComponent(utilId)}`, token);
}

export function getTable(token: string, utilId: string, code: string): Promise<DataTable> {
  return getJson<DataTable>(`/api/table?util=${encodeURIComponent(utilId)}&code=${encodeURIComponent(code)}`, token);
}

export interface RefreshJob {
  job_id: string;
  util: string;
  status: 'running' | 'done' | 'error';
  series_count?: number;
  observations_written?: number;
  refreshed_at?: string;
  error?: string;
}

/** Fire a refresh in the background. Returns immediately with a job_id. */
export async function refreshUtil(token: string, id: string): Promise<RefreshJob> {
  const res = await fetch(`${API_URL}/api/utils/${id}/refresh`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Refresh failed (${res.status})`);
  }
  return res.json();
}

/** Poll job status once. */
export async function getRefreshStatus(token: string, id: string): Promise<RefreshJob> {
  return getJson<RefreshJob>(`/api/utils/${id}/refresh`, token);
}

// Generates a util report on the server and downloads the returned PDF.
export async function downloadReport(token: string, utilId: string, reportId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/utils/${utilId}/reports/${reportId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Report failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${utilId}_${reportId}_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Render a util's server-side Python view to an HTML fragment.
export async function renderView(
  token: string,
  utilId: string,
  viewId: string,
  params: Record<string, string[]> = {},
): Promise<string> {
  const res = await fetch(`${API_URL}/api/utils/${utilId}/views/${viewId}/render`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `View render failed (${res.status})`);
  }
  const data = await res.json();
  return data.html as string;
}

function observationQuery(filters: ObservationFilters): string {
  const p = new URLSearchParams();
  (filters.seriesIds ?? []).forEach((id) => p.append('series', String(id)));
  if (filters.dateFrom) p.append('date_from', filters.dateFrom);
  if (filters.dateTo) p.append('date_to', filters.dateTo);
  if (filters.geography) p.append('geography', filters.geography);
  if (filters.limit != null) p.append('limit', String(filters.limit));
  if (filters.offset != null) p.append('offset', String(filters.offset));
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

export function queryObservations(
  token: string,
  filters: ObservationFilters = {},
): Promise<Observation[]> {
  return getJson<Observation[]>(`/api/observations${observationQuery(filters)}`, token);
}

// Total rows matching a filter (ignores limit/offset) — drives table pagination.
export async function countObservations(
  token: string,
  filters: ObservationFilters = {},
): Promise<number> {
  // Count ignores paging — drop limit/offset before building the query.
  const rest: ObservationFilters = { ...filters, limit: undefined, offset: undefined };
  const data = await getJson<{ total: number }>(
    `/api/observations/count${observationQuery(rest)}`,
    token,
  );
  return data.total;
}

// Downloads the filtered data as an .xlsx file (triggers a browser download).
export async function exportObservations(
  token: string,
  filters: ObservationFilters = {},
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/observations/export${observationQuery(filters)}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rockota_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
