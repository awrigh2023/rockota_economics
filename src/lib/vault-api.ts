/**
 * Thin fetch helpers for the Rockota vault endpoints.
 *
 * All vault reads are public (no token required for notes/public/**).
 * All vault writes require a Bearer token.
 * Chat requires a Bearer token.
 *
 * Pass `token` from useAuth() wherever you have it — the helpers include
 * the Authorization header only when a token is provided.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

function authHeaders(token?: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string, opts: RequestInit & { token?: string | null } = {}) {
  const { token, ...rest } = opts;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...authHeaders(token),
      ...(rest.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed (${res.status})`);
  }
  return res;
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface VaultFile {
  path: string;
  size: number;
  updatedAt: string;
  title?: string;
}

export interface VaultListResponse {
  files: VaultFile[];
}

export interface VaultReadResponse {
  path: string;
  content: string;
  size: number;
  updatedAt: string;
  title?: string;
  error?: string;
}

// ── Vault API ─────────────────────────────────────────────────────────────

export async function vaultList(token?: string | null): Promise<VaultListResponse> {
  const res = await apiFetch('/api/vault/list', { token });
  return res.json();
}

export async function vaultRead(path: string, token?: string | null): Promise<VaultReadResponse> {
  const res = await apiFetch(`/api/vault/read?path=${encodeURIComponent(path)}`, { token });
  return res.json();
}

export async function vaultWrite(
  path: string,
  content: string,
  token: string,
  overwrite = true,
): Promise<unknown> {
  const res = await apiFetch('/api/vault/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content, overwrite }),
    token,
  });
  return res.json();
}

export async function vaultDelete(path: string, token: string): Promise<void> {
  await apiFetch(`/api/vault/delete?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
    token,
  });
}

export async function vaultMove(
  from: string,
  to: string,
  token: string,
  isFolder = false,
): Promise<unknown> {
  const res = await apiFetch('/api/vault/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, isFolder }),
    token,
  });
  return res.json();
}

export async function vaultGraph(token?: string | null): Promise<{ nodes: unknown[]; edges: unknown[] }> {
  const res = await apiFetch('/api/vault/graph', { token });
  return res.json();
}

export { API_URL };
