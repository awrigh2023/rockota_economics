/**
 * Rockwell Console — a personal, owner-only command center.
 *
 * The board (buckets + tasks) is stored in the vault as a single Markdown file
 * whose canonical data lives in a fenced ```json block. This keeps tasks inside
 * the vault (greppable, in the graph) while reusing the existing, auth-scoped
 * vault read/write API. The console is gated to the owner in the UI; vault
 * writes already require auth.
 */
import { vaultRead, vaultWrite } from './vault-api';
import type { User } from './api';

// Owner gate — only this account sees/uses the console.
const OWNER_EMAIL = 'andrewwright2023@outlook.com';
const OWNER_ID = 1;

export function isOwner(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.id === OWNER_ID || user.email?.toLowerCase() === OWNER_EMAIL;
}

// Vault store. Must live under notes/users/andrew/ and end in .md (vault rule).
export const BOARD_PATH = 'notes/users/andrew/Rockota/_console/board.md';

export type Status = 'todo' | 'doing' | 'done';
export type Priority = 'none' | 'low' | 'med' | 'high';

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'Not started',
  doing: 'In progress',
  done: 'Done',
};
export const PRIORITY_LABEL: Record<Priority, string> = {
  none: 'None',
  low: 'Low',
  med: 'Medium',
  high: 'High',
};

export interface Bucket {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  bucketId: string;
  status: Status;
  priority: Priority;
  due: string | null; // YYYY-MM-DD
  notes: string;
  order: number; // sort order within its bucket
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  version: number;
  buckets: Bucket[];
  tasks: Task[];
}

export const SEED_BUCKETS = ['Rockota', 'Libertas', 'Metro Denver EDC', 'Personal'];

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultBoard(): Board {
  return {
    version: 1,
    buckets: SEED_BUCKETS.map((name) => ({ id: newId('b'), name })),
    tasks: [],
  };
}

// ── Parse / serialize ───────────────────────────────────────────────────────

const STATUSES: Status[] = ['todo', 'doing', 'done'];
const PRIORITIES: Priority[] = ['none', 'low', 'med', 'high'];

function coerceTask(raw: unknown, fallbackBucket: string): Task | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === 'string' ? r.title : '';
  if (!title.trim()) return null;
  const now = new Date().toISOString();
  const status = STATUSES.includes(r.status as Status) ? (r.status as Status) : 'todo';
  const priority = PRIORITIES.includes(r.priority as Priority) ? (r.priority as Priority) : 'none';
  return {
    id: typeof r.id === 'string' ? r.id : newId('t'),
    title,
    bucketId: typeof r.bucketId === 'string' ? r.bucketId : fallbackBucket,
    status,
    priority,
    due: typeof r.due === 'string' && r.due ? r.due : null,
    notes: typeof r.notes === 'string' ? r.notes : '',
    order: typeof r.order === 'number' ? r.order : 0,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  };
}

/** Extract and normalize a Board from the board.md content. Returns null if absent/invalid. */
export function parseBoard(md: string): Board | null {
  const m = md.match(/```json\s*([\s\S]*?)```/);
  if (!m) return null;
  let data: unknown;
  try {
    data = JSON.parse(m[1].trim());
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const rawBuckets = Array.isArray(d.buckets) ? d.buckets : [];
  const buckets: Bucket[] = rawBuckets
    .map((b) => {
      const bb = b as Record<string, unknown>;
      const name = typeof bb.name === 'string' ? bb.name : '';
      const id = typeof bb.id === 'string' ? bb.id : newId('b');
      return name.trim() ? { id, name } : null;
    })
    .filter((b): b is Bucket => b !== null);
  if (buckets.length === 0) return null;
  const fallback = buckets[0].id;
  const rawTasks = Array.isArray(d.tasks) ? d.tasks : [];
  const bucketIds = new Set(buckets.map((b) => b.id));
  const tasks: Task[] = rawTasks
    .map((t) => coerceTask(t, fallback))
    .filter((t): t is Task => t !== null)
    .map((t) => (bucketIds.has(t.bucketId) ? t : { ...t, bucketId: fallback }));
  return { version: 1, buckets, tasks };
}

/** Render a Board back to board.md markdown (json block is canonical). */
export function serializeBoard(board: Board): string {
  const today = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify(board, null, 2);
  const counts = board.buckets
    .map((b) => {
      const open = board.tasks.filter((t) => t.bucketId === b.id && t.status !== 'done').length;
      return `- **${b.name}** — ${open} open`;
    })
    .join('\n');
  return `---
type: console-board
title: Rockwell Console
updated: ${today}
---

# Rockwell Console

> Personal command center. The canonical data is the JSON block below, read and
> written by the Rockwell Console in the Rockota app. Hand-editing is fine as
> long as the JSON stays valid.

${counts || '- (no buckets yet)'}

\`\`\`json
${json}
\`\`\`
`;
}

// ── Load / save ─────────────────────────────────────────────────────────────

/** Load the board from the vault, or null if it doesn't exist yet. */
export async function loadBoard(token: string): Promise<Board | null> {
  try {
    const res = await vaultRead(BOARD_PATH, token);
    if (res.error || !res.content) return null;
    return parseBoard(res.content);
  } catch {
    // 404 (not created yet) or transient — treat as "no board".
    return null;
  }
}

/** Persist the board to the vault (creates the file if missing). */
export async function saveBoard(board: Board, token: string): Promise<void> {
  await vaultWrite(BOARD_PATH, serializeBoard(board), token, true);
}
