/**
 * Rockwell chat history — vault-backed, mirroring the Console store pattern.
 *
 * Each chat is a markdown file whose canonical data is a fenced ```json block;
 * a lightweight index file holds metadata so listing is a single read. Reuses
 * the existing auth-scoped /api/vault/* endpoints — no backend changes.
 *
 * Layout (under the user's private notes):
 *   _rockwell_chats/_index.md   -> { version, chats: ChatMeta[] }
 *   _rockwell_chats/<id>.md      -> full Chat (messages included)
 */
import { vaultRead, vaultWrite, vaultDelete } from './vault-api';

const DIR = 'notes/users/andrew/Rockota/_rockwell_chats';
const INDEX_PATH = `${DIR}/_index.md`;
const chatPath = (id: string) => `${DIR}/${id}.md`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
export interface ChatMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  source?: string;
  model?: string;
}
export interface Chat extends ChatMeta {
  messages: ChatMessage[];
}

export function newChatId(): string {
  return `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function autoTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  const t = (firstUser?.content ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return 'New chat';
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
}

// ── serialize / parse ───────────────────────────────────────────────────────

function extractJson(md: string): Record<string, unknown> | null {
  const m = md.match(/```json\s*([\s\S]*?)```/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1].trim());
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function sanitizeLine(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim();
}

function wrapIndex(chats: ChatMeta[]): string {
  const json = JSON.stringify({ version: 1, chats }, null, 2);
  return `---
type: rockwell-chat-index
updated: ${new Date().toISOString().slice(0, 10)}
---

# Rockwell Chats

${chats.length} saved conversation(s). Canonical data is the JSON block below.

\`\`\`json
${json}
\`\`\`
`;
}

function wrapChat(chat: Chat): string {
  const json = JSON.stringify(chat, null, 2);
  const preview = sanitizeLine(chat.messages.find((m) => m.role === 'user')?.content ?? '').slice(0, 200);
  return `---
type: rockwell-chat
updated: ${chat.updatedAt.slice(0, 10)}
---

# ${sanitizeLine(chat.title) || 'Untitled'}

> ${preview || 'Empty chat'}

\`\`\`json
${json}
\`\`\`
`;
}

function coerceMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => {
      const r = m as Record<string, unknown>;
      const role = r?.role === 'assistant' ? 'assistant' : r?.role === 'user' ? 'user' : null;
      const content = typeof r?.content === 'string' ? r.content : null;
      return role && content !== null ? { role, content } : null;
    })
    .filter((m): m is ChatMessage => m !== null);
}

function coerceMeta(raw: unknown): ChatMeta | null {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r.id !== 'string') return null;
  return {
    id: r.id,
    title: typeof r.title === 'string' && r.title ? r.title : 'Untitled',
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
    source: typeof r.source === 'string' ? r.source : undefined,
    model: typeof r.model === 'string' ? r.model : undefined,
  };
}

function byUpdatedDesc(a: ChatMeta, b: ChatMeta): number {
  return (b.updatedAt || '').localeCompare(a.updatedAt || '');
}

// ── operations ──────────────────────────────────────────────────────────────

export async function listChats(token: string): Promise<ChatMeta[]> {
  try {
    const res = await vaultRead(INDEX_PATH, token);
    if (res.error || !res.content) return [];
    const data = extractJson(res.content);
    const rawChats = Array.isArray(data?.chats) ? (data!.chats as unknown[]) : [];
    return rawChats.map(coerceMeta).filter((c): c is ChatMeta => c !== null).sort(byUpdatedDesc);
  } catch {
    return [];
  }
}

async function writeIndex(token: string, chats: ChatMeta[]): Promise<void> {
  await vaultWrite(INDEX_PATH, wrapIndex(chats), token, true);
}

export async function loadChat(token: string, id: string): Promise<Chat | null> {
  try {
    const res = await vaultRead(chatPath(id), token);
    if (res.error || !res.content) return null;
    const data = extractJson(res.content);
    if (!data) return null;
    return {
      id,
      title: typeof data.title === 'string' && data.title ? data.title : 'Untitled',
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
      source: typeof data.source === 'string' ? data.source : undefined,
      model: typeof data.model === 'string' ? data.model : undefined,
      messages: coerceMessages(data.messages),
    };
  } catch {
    return null;
  }
}

/** Write a chat file and update the index. Returns the fresh, sorted index. */
export async function saveChat(token: string, chat: Chat): Promise<ChatMeta[]> {
  const now = new Date().toISOString();
  const toSave: Chat = { ...chat, createdAt: chat.createdAt || now, updatedAt: now };
  await vaultWrite(chatPath(toSave.id), wrapChat(toSave), token, true);

  const chats = await listChats(token);
  const meta: ChatMeta = {
    id: toSave.id, title: toSave.title, createdAt: toSave.createdAt,
    updatedAt: toSave.updatedAt, source: toSave.source, model: toSave.model,
  };
  const i = chats.findIndex((c) => c.id === toSave.id);
  if (i >= 0) chats[i] = meta;
  else chats.push(meta);
  chats.sort(byUpdatedDesc);
  await writeIndex(token, chats);
  return chats;
}

export async function renameChat(token: string, id: string, title: string): Promise<ChatMeta[]> {
  const chat = await loadChat(token, id);
  if (chat) return saveChat(token, { ...chat, title });
  // Chat file missing — still fix the index entry.
  const chats = await listChats(token);
  const c = chats.find((x) => x.id === id);
  if (c) {
    c.title = title;
    c.updatedAt = new Date().toISOString();
    chats.sort(byUpdatedDesc);
    await writeIndex(token, chats);
  }
  return chats;
}

const ARCHIVE_DIR = `${DIR}/_archive`;

/** Move a chat into the archive folder and drop it from the active index. */
export async function archiveChat(token: string, id: string): Promise<ChatMeta[]> {
  const chat = await loadChat(token, id);
  if (chat) {
    try { await vaultWrite(`${ARCHIVE_DIR}/${id}.md`, wrapChat(chat), token, true); } catch { /* best effort */ }
  }
  try { await vaultDelete(chatPath(id), token); } catch { /* already gone */ }
  const chats = (await listChats(token)).filter((c) => c.id !== id);
  await writeIndex(token, chats);
  return chats;
}

export async function deleteChat(token: string, id: string): Promise<ChatMeta[]> {
  try {
    await vaultDelete(chatPath(id), token);
  } catch {
    /* already gone — fall through to index cleanup */
  }
  const chats = (await listChats(token)).filter((c) => c.id !== id);
  await writeIndex(token, chats);
  return chats;
}
