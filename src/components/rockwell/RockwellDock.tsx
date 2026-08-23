/**
 * RockwellDock — the persistent Rockwell assistant window (bring-your-own-model).
 *
 * Mounted once in Layout (outside the router Outlet) so it follows the user
 * across every page and keeps its conversation while navigating. Bottom-right:
 * a collapsed orb launcher that expands into a chat panel.
 *
 * BYOM: the browser talks to a model on the user's machine via an
 * OpenAI-compatible endpoint — either a local runner (Ollama) or the Rockwell
 * bridge wrapping the user's Claude subscription. The `Model` toggle switches
 * between them; a dropdown picks the specific model.
 *
 * Chat history (owner only) is saved in the vault via chatStore: switch chats,
 * rename, delete. Vault/util tool wiring through the model comes next.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  SendIcon, XIcon, Maximize2Icon, Minimize2Icon, MaximizeIcon, MinimizeIcon, SquarePenIcon, StopCircleIcon,
  RefreshCwIcon, DownloadIcon, MessagesSquareIcon, ArchiveIcon, PencilIcon, CheckIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  detectLocalModel, streamLocalChat, getModelUrl, setModelUrl,
  getPreferredModel, setPreferredModel, prettyModel,
  getSource, setSource, ModelSource, ModelStatus, LocalMsg,
} from '../../lib/localModel';
import { isOwner, loadBoard, saveBoard, newId, Board, Task } from '../../lib/console';
import { vaultSearch, API_URL } from '../../lib/vault-api';
import {
  listChats, loadChat, saveChat, renameChat, archiveChat as archiveChatStore,
  newChatId, autoTitle, ChatMeta, Chat,
} from '../../lib/chatStore';

// Rockota light palette. Names kept for minimal churn: NAVY = main surface
// (white), PANEL = secondary surface (soft teal-gray), GOLD = accent (teal).
const NAVY = '#ffffff';
const PANEL = '#eef5f3';
const GOLD = '#008080';

const PERSONA =
  'You are Rockwell, the assistant built into the Rockota web application (a ' +
  'browser app for economics). You are NOT a terminal, coding, or file-system ' +
  'agent: you have no working directory, no shell, no local files, and no external ' +
  'connectors. Never mention or speculate about sessions, working directories, ' +
  'connectors, OAuth, or "Claude Code" — none of that applies to you. Your only ' +
  "access to the user's Rockota vault is through notes the app supplies to you as " +
  'context in this conversation. When vault notes are provided, answer from them and ' +
  'cite the note path. If a question is about the user\'s notes but no vault notes ' +
  'were provided, say you did not find a matching note — do NOT claim you lack file ' +
  'access. You do positive economics: describe what the data shows and why, ' +
  'mechanistically, without value judgments or recommendations. Be concise and ' +
  'format replies in markdown.';

type ChatMsg = { role: 'user' | 'assistant'; content: string; sources?: string[] };
type ChatSession = { messages: ChatMsg[]; streaming: boolean };
type ActiveTaskRef = { id: string; title: string; bucket: string };
const MAX_CONCURRENT = 4; // cap on chats generating at the same time

// The Rockwell mark — master tiled icon, with an inline orb onError fallback.
function RockwellOrb({ size = 26, state = 'idle' }: { size?: number; state?: 'idle' | 'thinking' }) {
  const [err, setErr] = useState(false);
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {state === 'thinking' && (
        <span className="absolute inset-0 rounded-full animate-ping" style={{ background: `${GOLD}55` }} />
      )}
      {err ? (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={1.6} strokeLinecap="round">
          <circle cx="12" cy="12" r="9.5" />
          <ellipse cx="12" cy="12" rx="9.5" ry="3.6" />
          <ellipse cx="12" cy="12" rx="3.6" ry="9.5" />
          <circle cx="12" cy="12" r="2.1" fill={GOLD} stroke="none" />
        </svg>
      ) : (
        <img src="/rockwell_icon.svg" alt="Rockwell" width={size} height={size} draggable={false}
          onError={() => setErr(true)} className="rounded-full relative" style={{ display: 'block' }} />
      )}
    </span>
  );
}

const PAGE_LABEL: Record<string, string> = {
  '/': 'Home', '/library': 'The Empirics', '/utils': 'Utils',
  '/rockwell': 'Rockwell', '/console': 'Console', '/research': 'Research', '/data': 'Data',
};
function pageContext(pathname: string): string {
  if (pathname.startsWith('/utils/')) return 'a util';
  if (pathname.startsWith('/library/')) return 'a deck';
  return PAGE_LABEL[pathname] ?? 'Rockota';
}

function resolveModel(s: ModelStatus | null, src: ModelSource): string | null {
  if (!s?.connected) return null;
  const pref = getPreferredModel(src);
  return pref && s.models.includes(pref) ? pref : (s.models[0] ?? null);
}

export default function RockwellDock() {
  const { user, token } = useAuth();
  const location = useLocation();
  const owner = isOwner(user);
  const [open, setOpen] = useState<boolean>(() => localStorage.getItem('rw_open') === '1');
  const [expanded, setExpanded] = useState<boolean>(() => localStorage.getItem('rw_expanded') === '1');
  const [fullscreen, setFullscreen] = useState<boolean>(() => localStorage.getItem('rw_fullscreen') === '1');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [input, setInput] = useState('');
  const [sessions, setSessions] = useState<Record<string, ChatSession>>({}); // per-chat state → concurrency
  const [status, setStatus] = useState<ModelStatus | null>(null); // null = checking
  const [source, setSourceState] = useState<ModelSource>(getSource());
  const [modelName, setModelName] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState(getModelUrl());
  // Chat history (owner only)
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem('rw_active_chat') || null);
  const [showChats, setShowChats] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  // Console integration (fullscreen): task board + the task we're focused on.
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'tasks'>('chats');
  const [board, setBoard] = useState<Board | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskBucketId, setNewTaskBucketId] = useState('');
  const [taskByChat, setTaskByChat] = useState<Record<string, ActiveTaskRef | null>>(() => {
    try { return JSON.parse(localStorage.getItem('rw_task_by_chat') || '{}'); } catch { return {}; }
  });
  // Vault grounding: search the vault each turn and feed matches to the model.
  const [ground, setGround] = useState<boolean>(() => localStorage.getItem('rw_vault_ctx') !== '0');
  const [grounding, setGrounding] = useState<string | null>(null);
  const allowWrites = true; // always on; writes are still gated by propose-before-write in the bridge.
  const abortRefs = useRef<Record<string, AbortController>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { localStorage.setItem('rw_open', open ? '1' : '0'); }, [open]);
  useEffect(() => { localStorage.setItem('rw_expanded', expanded ? '1' : '0'); }, [expanded]);
  useEffect(() => { localStorage.setItem('rw_fullscreen', fullscreen ? '1' : '0'); }, [fullscreen]);
  // Lock background page scroll while Rockwell is full-screen.
  useEffect(() => {
    if (open && fullscreen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open, fullscreen]);
  useEffect(() => { localStorage.setItem('rw_vault_ctx', ground ? '1' : '0'); }, [ground]);
  useEffect(() => { localStorage.setItem('rw_task_by_chat', JSON.stringify(taskByChat)); }, [taskByChat]);
  useEffect(() => { if (activeId) localStorage.setItem('rw_active_chat', activeId); }, [activeId]);

  // (Re)load the console board whenever the Tasks tab is shown or a task is
  // focused — so buckets/tasks added elsewhere (e.g. the Console page) appear.
  useEffect(() => {
    const hasTask = !!(activeId && taskByChat[activeId]);
    if (open && owner && token && (hasTask || (fullscreen && sidebarTab === 'tasks'))) {
      loadBoard(token).then(setBoard).catch(() => { /* keep existing */ });
    }
  }, [open, owner, token, fullscreen, sidebarTab, activeId, taskByChat]);

  const check = useCallback(() => {
    setStatus(null);
    detectLocalModel().then(setStatus);
  }, []);

  const switchSource = useCallback((s: ModelSource) => {
    setSource(s);            // repoints the model URL to that preset
    setSourceState(s);
    setUrlDraft(getModelUrl());
    setStatus(null);
    detectLocalModel().then(setStatus);
  }, []);

  // Keep the resolved model name in sync with status + source.
  useEffect(() => { setModelName(resolveModel(status, source)); }, [status, source]);

  // Detect the model whenever the window opens.
  useEffect(() => { if (open) check(); }, [open, check]);

  // Load the saved chat list (owner only) when the window opens.
  useEffect(() => {
    if (open && owner && token) listChats(token).then(setChats).catch(() => setChats([]));
  }, [open, owner, token]);

  // Restore the active chat's messages on open (sessions aren't kept across reloads).
  useEffect(() => {
    if (open && activeId && token && !sessions[activeId]) {
      loadChat(token, activeId)
        .then((chat) => { if (chat) setSessions((prev) => ({ ...prev, [activeId]: { messages: chat.messages, streaming: false } })); })
        .catch(() => { /* leave empty */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeId, token]);

  // Summon / dismiss with Cmd/Ctrl+K.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [sessions, activeId, open]);

  // Auto-grow the input to fit what you've typed (up to a max), like Claude.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input, open, expanded, fullscreen]);

  if (!user) return null;

  const model = modelName;
  const messages = (activeId && sessions[activeId]?.messages) || [];
  const streaming = !!(activeId && sessions[activeId]?.streaming);
  const activeTask: ActiveTaskRef | null = activeId ? (taskByChat[activeId] ?? null) : null;
  const runningCount = Object.values(sessions).filter((s) => s.streaming).length;
  const patchSession = (id: string, up: (s: ChatSession) => ChatSession) =>
    setSessions((prev) => ({ ...prev, [id]: up(prev[id] || { messages: [], streaming: false }) }));

  function stop() {
    if (!activeId) return;
    abortRefs.current[activeId]?.abort();
    delete abortRefs.current[activeId];
    patchSession(activeId, (s) => ({ ...s, streaming: false }));
  }

  function chooseModel(id: string) {
    setPreferredModel(source, id);
    setModelName(id);
  }

  function newChat() {
    const id = newChatId();
    setSessions((prev) => ({ ...prev, [id]: { messages: [], streaming: false } }));
    setActiveId(id);
    setInput('');
    setShowChats(false);
  }

  async function openChat(id: string) {
    if (!token) return;
    setActiveId(id);
    setShowChats(false);
    if (!sessions[id]) {
      const chat = await loadChat(token, id);
      patchSession(id, () => ({ messages: chat?.messages ?? [], streaming: false }));
    }
  }

  async function archiveChat(id: string) {
    if (!token) return;
    const next = await archiveChatStore(token, id);
    setChats(next);
    setSessions((prev) => { const c = { ...prev }; delete c[id]; return c; });
    if (activeId === id) newChat();
  }

  async function commitRename(id: string) {
    if (!token) { setRenamingId(null); return; }
    const title = renameDraft.trim();
    setRenamingId(null);
    if (title) setChats(await renameChat(token, id, title));
  }

  async function persistTurn(chatId: string, finalMsgs: ChatMsg[]) {
    if (!owner || !token) return;
    const existing = chats.find((c) => c.id === chatId);
    const now = new Date().toISOString();
    const chat: Chat = {
      id: chatId,
      title: existing?.title || autoTitle(finalMsgs),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      source,
      model: model || undefined,
      messages: finalMsgs,
    };
    try { setChats(await saveChat(token, chat)); } catch { /* offline — keep chatting */ }
  }

  async function setTaskStatus(taskId: string, next: Task['status']) {
    if (!token || !board) return;
    const updated: Board = {
      ...board,
      tasks: board.tasks.map((t) => (t.id === taskId ? { ...t, status: next, updatedAt: new Date().toISOString() } : t)),
    };
    setBoard(updated);
    try { await saveBoard(updated, token); } catch { /* keep local state; retry later */ }
  }

  function refreshBoard() {
    if (token) loadBoard(token).then(setBoard).catch(() => { /* keep existing */ });
  }

  async function addTask() {
    const title = newTaskTitle.trim();
    if (!title || !token || !board) return;
    const bucketId = newTaskBucketId || board.buckets[0]?.id;
    if (!bucketId) return;
    const now = new Date().toISOString();
    const task: Task = {
      id: newId('t'), title, bucketId, status: 'todo', priority: 'none',
      due: null, notes: '', order: 0, createdAt: now, updatedAt: now,
    };
    const updated: Board = { ...board, tasks: [task, ...board.tasks] };
    setBoard(updated);
    setNewTaskTitle('');
    try { await saveBoard(updated, token); } catch { /* keep local; retry later */ }
  }

  function taskContextFor(at: ActiveTaskRef | null): LocalMsg | null {
    if (!at) return null;
    const full = board?.tasks.find((t) => t.id === at.id);
    const notes = full?.notes?.trim();
    return {
      role: 'system',
      content:
        `The user is working on a task from their Rockota console: "${at.title}" (bucket: ${at.bucket}).` +
        (notes ? `\nTask notes:\n${notes}` : '') +
        '\nHelp drive this task to completion: propose next steps, pull in any needed context (use your vault tools if available), and keep the conversation focused on it.',
    };
  }

  function startTask(t: Task, bucketName: string) {
    const id = newChatId();
    const at: ActiveTaskRef = { id: t.id, title: t.title, bucket: bucketName };
    setSessions((prev) => ({ ...prev, [id]: { messages: [], streaming: false } }));
    setTaskByChat((prev) => ({ ...prev, [id]: at }));
    setActiveId(id);
    setInput('');
    setShowChats(false);
    if (t.status !== 'doing') setTaskStatus(t.id, 'doing');
    // Kick off with context so Rockwell opens with a plan (new chat, so pass id + task).
    if (status?.connected && model) {
      send(`Let's work on this task: "${t.title}". Give me a short plan to complete it, then we'll go step by step.`, id, at);
    }
  }

  async function completeTask() {
    if (!activeId) return;
    const at = taskByChat[activeId];
    if (!at) return;
    await setTaskStatus(at.id, 'done');
    setTaskByChat((prev) => ({ ...prev, [activeId]: null }));
    patchSession(activeId, (s) => ({ ...s, messages: [...s.messages, { role: 'assistant', content: `✓ Marked **${at.title}** complete on your console.` }] }));
  }

  async function send(overrideText?: string, targetId?: string, taskOverride?: ActiveTaskRef) {
    const chatId = targetId ?? activeId;
    const text = (overrideText ?? input).trim();
    if (!text || !chatId || !status?.connected || !model) return;
    if (sessions[chatId]?.streaming) return; // this chat is already generating
    if (runningCount >= MAX_CONCURRENT) {
      patchSession(chatId, (s) => ({ ...s, messages: [...s.messages, { role: 'assistant', content: `⚠ Too many chats are generating at once (max ${MAX_CONCURRENT}). Let one finish first.` }] }));
      return;
    }
    if (overrideText === undefined) setInput('');
    const prior = sessions[chatId]?.messages ?? [];
    const history: LocalMsg[] = prior.map((m) => ({ role: m.role, content: m.content }));
    patchSession(chatId, (s) => ({ messages: [...s.messages, { role: 'user', content: text }, { role: 'assistant', content: '' }], streaming: true }));
    const controller = new AbortController();
    abortRefs.current[chatId] = controller;

    // Vault access takes one of two forms:
    //  • Claude path: hand the model real read-only tools (the bridge loads our
    //    MCP server). We pass the token so the bridge can enable them.
    //  • Local path: one-shot retrieval grounding — search now and inject the
    //    top matching notes as context (weaker models can't drive tools).
    const useClaudeTools = source === 'claude' && owner && !!token && ground;
    let contextMsg: LocalMsg | null = null;
    let sources: string[] = [];
    if (ground && owner && token && source === 'local') {
      setGrounding('Searching your vault…');
      try {
        const { hits } = await vaultSearch(text, token, 8, controller.signal);
        // Don't ground on Rockwell's own saved chat logs — that's self-referential noise.
        const useful = hits.filter((h) => !h.path.includes('/_rockwell_chats/')).slice(0, 6);
        sources = useful.map((h) => h.path);
        if (useful.length) {
          const ctx = useful.map((h) => `### ${h.path}\n${h.snippet}`).join('\n\n').slice(0, 4000);
          contextMsg = {
            role: 'system',
            content:
              "These notes came from a search of the user's Rockota vault for this question. " +
              'Ground your answer in them when relevant and cite the note path(s). If they do not cover the question, say so plainly.\n\n' +
              ctx,
          };
        }
      } catch { /* search failed/aborted — answer without grounding */ }
      setGrounding(null);
    }

    const taskMsg = taskContextFor(taskOverride ?? taskByChat[chatId] ?? null);
    const req: LocalMsg[] = [
      { role: 'system', content: PERSONA },
      ...(taskMsg ? [taskMsg] : []),
      ...(contextMsg ? [contextMsg] : []),
      ...history,
      { role: 'user', content: text },
    ];
    const auth = useClaudeTools && token ? { token, apiBase: API_URL, allowWrites } : undefined;
    let acc = '';
    try {
      for await (const tok of streamLocalChat(model, req, controller.signal, auth)) {
        acc += tok;
        patchSession(chatId, (s) => {
          const c = [...s.messages];
          c[c.length - 1] = { role: 'assistant', content: acc, sources };
          return { ...s, messages: c };
        });
      }
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') {
        patchSession(chatId, (s) => {
          const c = [...s.messages];
          if (c.length && c[c.length - 1].role === 'assistant' && !c[c.length - 1].content) {
            c[c.length - 1] = { role: 'assistant', content: '⚠ Lost contact with your model. Is the server still running?' };
          }
          return { ...s, messages: c };
        });
      }
    } finally {
      patchSession(chatId, (s) => ({ ...s, streaming: false }));
      delete abortRefs.current[chatId];
      setGrounding(null);
      if (acc.trim()) {
        const finalMsgs: ChatMsg[] = [...prior, { role: 'user', content: text }, { role: 'assistant', content: acc, sources }];
        persistTurn(chatId, finalMsgs);
      }
    }
  }

  // Collapsed launcher
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Rockwell (Cmd/Ctrl+K)"
        className="fixed bottom-5 right-5 z-[60] flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{ width: 56, height: 56, background: NAVY, border: `2px solid ${GOLD}` }}
      >
        <span className="absolute inset-0 rounded-full animate-pulse" style={{ background: `${GOLD}22` }} />
        <RockwellOrb size={30} />
      </button>
    );
  }

  // Position/size: bottom-right at two sizes, or full-screen with a small inset.
  const showSidebar = owner && fullscreen && sidebarOpen;
  const posStyle = fullscreen
    ? { top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 }
    : {
        bottom: 20,
        right: 20,
        width: expanded ? 'min(620px, calc(100vw - 40px))' : 'min(440px, calc(100vw - 40px))',
        height: expanded ? 'min(88vh, 940px)' : 'min(82vh, 720px)',
      };

  const statusLine = status === null
    ? 'Looking for your model…'
    : status.connected
      ? `${source === 'claude' ? 'Claude' : 'Local'} · ${model ? prettyModel(source, model) : '—'}`
      : 'No model connected';

  // Chat list, reused as the overlay (small/expanded) and the sidebar (fullscreen).
  const chatListInner = (
    <>
      <button onClick={newChat}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium mb-3"
        style={{ background: GOLD, color: NAVY }}>
        <SquarePenIcon size={15} /> New chat
      </button>
      {chats.length === 0 ? (
        <p className="text-[12px] text-center mt-6" style={{ color: 'rgba(0,0,0,0.45)' }}>
          No saved chats yet. Start a conversation and it'll be saved here.
        </p>
      ) : (
        <ul className="space-y-1">
          {chats.map((c) => (
            <li key={c.id}
              className="group flex items-center gap-1.5 rounded-md px-2 py-1.5"
              style={{ background: c.id === activeId ? `${GOLD}1f` : 'transparent', border: `1px solid ${c.id === activeId ? `${GOLD}44` : 'transparent'}` }}>
              {renamingId === c.id ? (
                <>
                  <input autoFocus value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(c.id); if (e.key === 'Escape') setRenamingId(null); }}
                    className="flex-1 rounded px-1.5 py-0.5 text-[13px]"
                    style={{ background: NAVY, border: `1px solid ${GOLD}55`, color: '#1f2a44' }} />
                  <button onClick={() => commitRename(c.id)} title="Save name" className="p-1 rounded hover:bg-black/5" style={{ color: GOLD }}>
                    <CheckIcon size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => openChat(c.id)} className="flex-1 min-w-0 text-left" title={c.title}>
                    <span className="flex items-center gap-1.5">
                      {sessions[c.id]?.streaming && (
                        <span className="animate-pulse" style={{ width: 6, height: 6, borderRadius: 9999, background: GOLD, flexShrink: 0 }} />
                      )}
                      <span className="truncate text-[13px]" style={{ color: '#1f2a44' }}>{c.title}</span>
                    </span>
                    <span className="block text-[10px]" style={{ color: 'rgba(0,0,0,0.4)' }}>
                      {sessions[c.id]?.streaming ? 'working…' : (c.updatedAt ? c.updatedAt.slice(0, 10) : '')}{c.source === 'claude' ? ' · Claude' : c.source === 'local' ? ' · Local' : ''}
                    </span>
                  </button>
                  <button onClick={() => { setRenamingId(c.id); setRenameDraft(c.title); }} title="Rename"
                    className="p-1 rounded hover:bg-black/5 opacity-0 group-hover:opacity-100" style={{ color: 'rgba(0,0,0,0.6)' }}>
                    <PencilIcon size={13} />
                  </button>
                  <button onClick={() => archiveChat(c.id)} title="Archive"
                    className="p-1 rounded hover:bg-black/5 opacity-0 group-hover:opacity-100" style={{ color: 'rgba(0,0,0,0.6)' }}>
                    <ArchiveIcon size={13} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );

  // Console tasks (fullscreen Tasks tab), grouped by bucket, open items only.
  const openTasks = board ? board.tasks.filter((t) => t.status !== 'done') : [];
  const taskListInner = (
    <>
      {!board ? (
        <p className="text-[12px] text-center mt-6" style={{ color: 'rgba(0,0,0,0.45)' }}>Loading your console…</p>
      ) : (
      <>
        {/* Quick add */}
        <div className="mb-3 flex flex-col gap-1.5">
          <input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
            placeholder="New task…"
            className="rounded-md px-2 py-1.5 text-[13px]"
            style={{ background: NAVY, border: `1px solid ${GOLD}33`, color: '#1f2a44' }}
          />
          <div className="flex gap-1.5">
            <select
              value={newTaskBucketId || board.buckets[0]?.id || ''}
              onChange={(e) => setNewTaskBucketId(e.target.value)}
              className="flex-1 rounded-md px-2 py-1 text-[11px] focus:outline-none"
              style={{ background: NAVY, color: '#1f2a44', border: `1px solid ${GOLD}33` }}
            >
              {board.buckets.map((b) => (
                <option key={b.id} value={b.id} style={{ background: NAVY }}>{b.name}</option>
              ))}
            </select>
            <button onClick={addTask} disabled={!newTaskTitle.trim()}
              className="px-3 py-1 rounded-md text-[11px] font-medium disabled:opacity-40"
              style={{ background: GOLD, color: NAVY }}>Add</button>
          </div>
        </div>
        {openTasks.length === 0 ? (
          <p className="text-[12px] text-center mt-4" style={{ color: 'rgba(0,0,0,0.45)' }}>No open tasks yet.</p>
        ) : (
          board.buckets.map((b) => {
          const items = openTasks.filter((t) => t.bucketId === b.id);
          if (!items.length) return null;
          return (
            <div key={b.id} className="mb-3">
              <div className="text-[10px] uppercase tracking-wide mb-1 px-1" style={{ color: 'rgba(0,0,0,0.4)' }}>{b.name}</div>
              <ul className="space-y-1">
                {items.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => startTask(t, b.name)} title={t.title}
                      className="w-full text-left rounded-md px-2 py-1.5 flex items-center gap-2"
                      style={{ background: activeTask?.id === t.id ? `${GOLD}1f` : 'transparent', border: `1px solid ${activeTask?.id === t.id ? `${GOLD}44` : 'transparent'}` }}>
                      <span style={{ width: 6, height: 6, borderRadius: 99, flexShrink: 0, background: t.status === 'doing' ? '#f59e0b' : 'rgba(0,0,0,0.3)' }} />
                      <span className="flex-1 min-w-0 truncate text-[13px]" style={{ color: '#1f2a44' }}>{t.title}</span>
                      {t.due && <span className="text-[10px]" style={{ color: 'rgba(0,0,0,0.4)' }}>{t.due.slice(5)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
        )}
      </>
      )}
    </>
  );

  return (
    <div
      className="fixed z-[60] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
      style={{ ...posStyle, background: NAVY, border: `1px solid ${GOLD}33`, color: '#1f2a44' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: PANEL, borderBottom: `1px solid ${GOLD}22` }}>
        <RockwellOrb size={24} state={streaming ? 'thinking' : 'idle'} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight" style={{ color: '#0f2e2e' }}>Rockwell</div>
          <div className="text-[11px] leading-tight flex items-center gap-1.5" style={{ color: 'rgba(0,0,0,0.55)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: status?.connected ? '#4ade80' : '#f59e0b', display: 'inline-block' }} />
            {statusLine}
          </div>
        </div>
        {owner && (
          <button onClick={() => (fullscreen ? setSidebarOpen((v) => !v) : setShowChats((v) => !v))}
            title="Chat history" className="p-1.5 rounded-md hover:bg-black/5"
            style={{ color: (fullscreen ? sidebarOpen : showChats) ? GOLD : 'rgba(0,0,0,0.7)' }}>
            <MessagesSquareIcon size={16} />
          </button>
        )}
        <button onClick={newChat} title="New chat" className="p-1.5 rounded-md hover:bg-black/5" style={{ color: 'rgba(0,0,0,0.7)' }}>
          <SquarePenIcon size={16} />
        </button>
        <button onClick={() => { setExpanded((e) => !e); setFullscreen(false); }} title={expanded ? 'Shrink' : 'Expand'} className="p-1.5 rounded-md hover:bg-black/5" style={{ color: 'rgba(0,0,0,0.7)' }}>
          {expanded ? <Minimize2Icon size={16} /> : <Maximize2Icon size={16} />}
        </button>
        <button onClick={() => setFullscreen((f) => !f)} title={fullscreen ? 'Exit full screen' : 'Full screen'} className="p-1.5 rounded-md hover:bg-black/5" style={{ color: fullscreen ? GOLD : 'rgba(0,0,0,0.7)' }}>
          {fullscreen ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
        </button>
        <button onClick={() => setOpen(false)} title="Minimize" className="p-1.5 rounded-md hover:bg-black/5" style={{ color: 'rgba(0,0,0,0.7)' }}>
          <XIcon size={16} />
        </button>
      </div>

      {/* Model-source toggle + model dropdown */}
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: PANEL, borderBottom: `1px solid ${GOLD}14` }}>
        <span className="text-[10px] mr-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>Model</span>
        {(['local', 'claude'] as ModelSource[]).map((s) => (
          <button
            key={s}
            onClick={() => switchSource(s)}
            disabled={streaming}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
            style={source === s
              ? { background: GOLD, color: NAVY }
              : { background: 'transparent', color: 'rgba(0,0,0,0.65)', border: `1px solid ${GOLD}33` }}
          >
            {s === 'local' ? 'Local model' : 'Claude'}
          </button>
        ))}
        {owner && (
          <button
            onClick={() => setGround((v) => !v)}
            disabled={streaming}
            title={ground ? 'Vault grounding on — Rockwell searches your notes each turn' : 'Vault grounding off'}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
            style={ground
              ? { background: GOLD, color: NAVY }
              : { background: 'transparent', color: 'rgba(0,0,0,0.65)', border: `1px solid ${GOLD}33` }}
          >
            Vault
          </button>
        )}
        {status?.connected && status.models.length > 0 && (
          <select
            value={model ?? ''}
            onChange={(e) => chooseModel(e.target.value)}
            disabled={streaming}
            title="Choose model"
            className="ml-auto rounded-md px-2 py-1 text-[11px] disabled:opacity-50 focus:outline-none"
            style={{ background: NAVY, color: '#1f2a44', border: `1px solid ${GOLD}33`, maxWidth: 150 }}
          >
            {status.models.map((id) => (
              <option key={id} value={id} style={{ background: NAVY }}>{prettyModel(source, id)}</option>
            ))}
          </select>
        )}
      </div>

      {/* Body: optional chat sidebar (fullscreen) + main column */}
      <div className="flex-1 flex min-h-0">
      {showSidebar && (
        <aside className="w-60 shrink-0 flex flex-col overflow-hidden" style={{ borderRight: `1px solid ${GOLD}22`, background: PANEL }}>
          <div className="flex items-center gap-1 px-2.5 pt-3 pb-2">
            {(['chats', 'tasks'] as const).map((tab) => (
              <button key={tab} onClick={() => setSidebarTab(tab)}
                className="flex-1 rounded-md py-1 text-[11px] font-medium"
                style={sidebarTab === tab
                  ? { background: GOLD, color: NAVY }
                  : { background: 'transparent', color: 'rgba(0,0,0,0.6)', border: `1px solid ${GOLD}33` }}>
                {tab === 'chats' ? 'Chats' : 'Tasks'}
              </button>
            ))}
            {sidebarTab === 'tasks' && (
              <button onClick={refreshBoard} title="Refresh tasks" className="p-1 rounded-md hover:bg-black/5" style={{ color: 'rgba(0,0,0,0.6)' }}>
                <RefreshCwIcon size={13} />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-2.5 pb-3">
            {sidebarTab === 'chats' ? chatListInner : taskListInner}
          </div>
        </aside>
      )}
      <div className="flex-1 flex flex-col min-h-0">
      {activeTask && (
        <div className="flex items-center gap-2 px-3 py-2 text-[12px]" style={{ background: `${GOLD}14`, borderBottom: `1px solid ${GOLD}22` }}>
          <span style={{ color: 'rgba(0,0,0,0.6)' }}>Working on:</span>
          <span className="flex-1 min-w-0 truncate font-medium" style={{ color: '#0f2e2e' }} title={activeTask.title}>{activeTask.title}</span>
          <button onClick={completeTask} className="px-2 py-0.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1" style={{ background: '#4ade80', color: NAVY }}>
            <CheckIcon size={12} /> Complete
          </button>
          <button onClick={() => { if (activeId) setTaskByChat((prev) => ({ ...prev, [activeId]: null })); }} title="Unfocus task" className="p-1 rounded hover:bg-black/5" style={{ color: 'rgba(0,0,0,0.6)' }}>
            <XIcon size={13} />
          </button>
        </div>
      )}
      {owner && !fullscreen && showChats ? (
        <div className="flex-1 overflow-y-auto px-3 py-3" style={{ color: 'rgba(0,0,0,0.85)' }}>
          {chatListInner}
        </div>
      ) : status !== null && !status.connected ? (
        /* Not connected → setup panel */
        <div className="flex-1 overflow-y-auto px-5 py-6" style={{ color: 'rgba(0,0,0,0.8)' }}>
          <div className="flex flex-col items-center text-center mb-5">
            <RockwellOrb size={44} />
            <h3 className="mt-3 text-base font-semibold" style={{ color: '#0f2e2e' }}>
              {source === 'claude' ? 'Connect your Claude subscription' : 'Bring your own model'}
            </h3>
            <p className="mt-1 text-[13px]" style={{ color: 'rgba(0,0,0,0.6)' }}>
              {source === 'claude'
                ? 'Run the Rockwell bridge on your machine — it uses your Claude plan (no API key, no per-token cost).'
                : <>Rockwell runs on a model on <em>your</em> machine — nothing goes to a paid API. Set one up to start.</>}
            </p>
          </div>
          {source === 'claude' ? (
            <ol className="text-[13px] space-y-2.5 mb-5" style={{ color: 'rgba(0,0,0,0.8)' }}>
              <li><span style={{ color: GOLD }}>1.</span> Install Claude Code &amp; sign in: <code className="px-1 rounded" style={{ background: 'rgba(0,0,0,0.06)'}}>npm i -g @anthropic-ai/claude-code</code> then <code className="px-1 rounded" style={{ background: 'rgba(0,0,0,0.06)'}}>claude login</code></li>
              <li><span style={{ color: GOLD }}>2.</span> Start the bridge: <code className="px-1 rounded" style={{ background: 'rgba(0,0,0,0.06)'}}>cd rockwell-bridge</code> then <code className="px-1 rounded" style={{ background: 'rgba(0,0,0,0.06)'}}>node server.mjs</code></li>
              <li><span style={{ color: GOLD }}>3.</span> It listens on <code className="px-1 rounded" style={{ background: 'rgba(0,0,0,0.06)'}}>localhost:4025</code>.</li>
              <li><span style={{ color: GOLD }}>4.</span> Recheck below.</li>
            </ol>
          ) : (
            <ol className="text-[13px] space-y-2.5 mb-5" style={{ color: 'rgba(0,0,0,0.8)' }}>
              <li><span style={{ color: GOLD }}>1.</span> Install a local model runner — <a href="https://ollama.com" target="_blank" rel="noreferrer" style={{ color: GOLD }}>Ollama</a> is easiest.</li>
              <li><span style={{ color: GOLD }}>2.</span> Pull a model, e.g. <code className="px-1 rounded" style={{ background: 'rgba(0,0,0,0.06)'}}>ollama pull llama3.1</code></li>
              <li><span style={{ color: GOLD }}>3.</span> Allow this site to connect: set <code className="px-1 rounded" style={{ background: 'rgba(0,0,0,0.06)'}}>OLLAMA_ORIGINS</code> to include <code className="px-1 rounded" style={{ background: 'rgba(0,0,0,0.06)'}}>{window.location.origin}</code></li>
              <li><span style={{ color: GOLD }}>4.</span> Recheck below.</li>
            </ol>
          )}
          <label className="block text-[11px] mb-1" style={{ color: 'rgba(0,0,0,0.5)' }}>
            {source === 'claude' ? 'Bridge URL' : 'Local model URL'}
          </label>
          <div className="flex gap-2 mb-3">
            <input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)}
              className="flex-1 rounded-md px-2.5 py-1.5 text-sm" style={{ background: NAVY, border: `1px solid ${GOLD}33`, color: '#1f2a44' }} />
            <button onClick={() => { setModelUrl(urlDraft); check(); }}
              className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: GOLD, color: NAVY }}>Save</button>
          </div>
          <button onClick={check} className="w-full inline-flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium"
            style={{ border: `1px solid ${GOLD}55`, color: GOLD }}>
            <RefreshCwIcon size={15} /> Recheck connection
          </button>
          {source !== 'claude' && (
            <a href="https://ollama.com/download" target="_blank" rel="noreferrer"
              className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-md py-2 text-sm"
              style={{ color: 'rgba(0,0,0,0.6)' }}>
              <DownloadIcon size={15} /> Download Ollama
            </a>
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {status === null && (
              <div className="h-full flex items-center justify-center text-sm" style={{ color: 'rgba(0,0,0,0.5)' }}>
                Looking for your model…
              </div>
            )}
            {status?.connected && messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4" style={{ color: 'rgba(0,0,0,0.55)' }}>
                <img src="/rockwell_logo.svg" alt="Rockwell" style={{ width: 'min(220px, 75%)', height: 'auto' }} draggable={false} />
                <p className="mt-3 text-sm" style={{ color: 'rgba(0,0,0,0.85)' }}>Running on {source === 'claude' ? 'Claude' : 'your model'} — {model ? prettyModel(source, model) : '—'}.</p>
                <p className="mt-1 text-[12px]">Ask me anything.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                  style={m.role === 'user' ? { background: GOLD, color: NAVY } : { background: PANEL, color: '#1f2a44', border: `1px solid ${GOLD}1a` }}>
                  {m.role === 'assistant' ? (
                    <div className="rw-md">
                      {m.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      ) : (
                        <span className="inline-flex items-center gap-2" style={{ color: 'rgba(0,0,0,0.5)' }}>
                          <RockwellOrb size={22} state="thinking" /> Thinking…
                        </span>
                      )}
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 pt-1.5 text-[10px]" style={{ borderTop: `1px solid ${GOLD}22`, color: 'rgba(0,0,0,0.45)' }}>
                          Vault: {m.sources.map((p) => p.split('/').pop()).join(', ')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                  )}
                </div>
              </div>
            ))}
            {grounding && (
              <div className="flex justify-start">
                <div className="text-[11px] inline-flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ color: GOLD, background: `${GOLD}12` }}>
                  <RefreshCwIcon size={12} className="animate-spin" /> {grounding}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-3" style={{ background: PANEL, borderTop: `1px solid ${GOLD}22` }}>
            <div className="flex items-end gap-2 rounded-xl px-3 py-2" style={{ background: NAVY, border: `1px solid ${GOLD}33`, opacity: status?.connected ? 1 : 0.5 }}>
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                disabled={!status?.connected}
                placeholder={status?.connected ? 'Ask Rockwell…' : 'Connect a model to chat'}
                className="flex-1 resize-none bg-transparent text-sm focus:outline-none"
                style={{ color: '#1f2a44', maxHeight: 200, overflowY: 'auto' }}
              />
              {streaming ? (
                <button onClick={stop} title="Stop" className="p-1.5 rounded-lg" style={{ color: GOLD }}><StopCircleIcon size={20} /></button>
              ) : (
                <button onClick={() => send()} disabled={!input.trim() || !status?.connected} title="Send" className="p-1.5 rounded-lg disabled:opacity-40" style={{ color: GOLD }}><SendIcon size={18} /></button>
              )}
            </div>
            <div className="text-[10px] text-center mt-1.5" style={{ color: 'rgba(0,0,0,0.35)' }}>
              Your model, your machine · on {pageContext(location.pathname)} · Cmd/Ctrl+K to toggle
              {source === 'claude' && (
                <>
                  {' · '}
                  <a href="https://claude.ai/settings/usage" target="_blank" rel="noreferrer" style={{ color: GOLD }}>
                    Claude usage ↗
                  </a>
                </>
              )}
            </div>
          </div>
        </>
      )}
      </div>
      </div>
    </div>
  );
}
