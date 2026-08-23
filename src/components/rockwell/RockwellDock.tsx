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
  SendIcon, XIcon, Maximize2Icon, Minimize2Icon, SquarePenIcon, StopCircleIcon,
  RefreshCwIcon, DownloadIcon, MessagesSquareIcon, Trash2Icon, PencilIcon, CheckIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  detectLocalModel, streamLocalChat, getModelUrl, setModelUrl,
  getPreferredModel, setPreferredModel, prettyModel,
  getSource, setSource, ModelSource, ModelStatus, LocalMsg,
} from '../../lib/localModel';
import { isOwner } from '../../lib/console';
import { vaultSearch, API_URL } from '../../lib/vault-api';
import {
  listChats, loadChat, saveChat, renameChat, deleteChat,
  newChatId, autoTitle, ChatMeta, Chat,
} from '../../lib/chatStore';

const NAVY = '#0f1830';
const PANEL = '#131d38';
const GOLD = '#d7c770';

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
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<ModelStatus | null>(null); // null = checking
  const [source, setSourceState] = useState<ModelSource>(getSource());
  const [modelName, setModelName] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState(getModelUrl());
  // Chat history (owner only)
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showChats, setShowChats] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  // Vault grounding: search the vault each turn and feed matches to the model.
  const [ground, setGround] = useState<boolean>(() => localStorage.getItem('rw_vault_ctx') !== '0');
  const [grounding, setGrounding] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem('rw_open', open ? '1' : '0'); }, [open]);
  useEffect(() => { localStorage.setItem('rw_expanded', expanded ? '1' : '0'); }, [expanded]);
  useEffect(() => { localStorage.setItem('rw_vault_ctx', ground ? '1' : '0'); }, [ground]);

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
  }, [messages, open]);

  if (!user) return null;

  const model = modelName;

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }

  function chooseModel(id: string) {
    setPreferredModel(source, id);
    setModelName(id);
  }

  function newChat() {
    if (streaming) stop();
    setMessages([]);
    setActiveId(null);
    setInput('');
    setShowChats(false);
  }

  async function openChat(id: string) {
    if (!token) return;
    if (streaming) stop();
    const chat = await loadChat(token, id);
    if (chat) {
      setMessages(chat.messages);
      setActiveId(id);
    }
    setShowChats(false);
  }

  async function removeChat(id: string) {
    if (!token) return;
    const next = await deleteChat(token, id);
    setChats(next);
    if (activeId === id) { setActiveId(null); setMessages([]); }
  }

  async function commitRename(id: string) {
    if (!token) { setRenamingId(null); return; }
    const title = renameDraft.trim();
    setRenamingId(null);
    if (title) setChats(await renameChat(token, id, title));
  }

  async function persistTurn(finalMsgs: ChatMsg[]) {
    if (!owner || !token) return;
    const id = activeId || newChatId();
    const existing = chats.find((c) => c.id === id);
    const now = new Date().toISOString();
    const chat: Chat = {
      id,
      title: existing?.title || autoTitle(finalMsgs),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      source,
      model: model || undefined,
      messages: finalMsgs,
    };
    if (!activeId) setActiveId(id);
    try { setChats(await saveChat(token, chat)); } catch { /* offline — keep chatting */ }
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming || !status?.connected || !model) return;
    setInput('');
    const prior = messages;
    const history: LocalMsg[] = prior.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    // Vault access takes one of two forms:
    //  • Claude path: hand the model real read-only tools (the bridge loads our
    //    MCP server). We pass the token so the bridge can enable them.
    //  • Local path: one-shot retrieval grounding — search now and inject the
    //    top matching notes as context (weaker models can't drive tools).
    const useClaudeTools = source === 'claude' && ground && owner && !!token;
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

    const req: LocalMsg[] = [
      { role: 'system', content: PERSONA },
      ...(contextMsg ? [contextMsg] : []),
      ...history,
      { role: 'user', content: text },
    ];
    const auth = useClaudeTools && token ? { token, apiBase: API_URL } : undefined;
    let acc = '';
    try {
      for await (const tok of streamLocalChat(model, req, controller.signal, auth)) {
        acc += tok;
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: 'assistant', content: acc, sources };
          return c;
        });
      }
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') {
        setMessages((m) => {
          const c = [...m];
          if (c.length && c[c.length - 1].role === 'assistant' && !c[c.length - 1].content) {
            c[c.length - 1] = { role: 'assistant', content: '⚠ Lost contact with your model. Is the server still running?' };
          }
          return c;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      setGrounding(null);
      if (acc.trim()) {
        const finalMsgs: ChatMsg[] = [...prior, { role: 'user', content: text }, { role: 'assistant', content: acc, sources }];
        persistTurn(finalMsgs);
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
        style={{ width: 56, height: 56, background: NAVY, border: `1px solid ${GOLD}55` }}
      >
        <span className="absolute inset-0 rounded-full animate-pulse" style={{ background: `${GOLD}22` }} />
        <RockwellOrb size={30} />
      </button>
    );
  }

  const width = expanded ? 'min(560px, calc(100vw - 40px))' : 'min(384px, calc(100vw - 40px))';
  const height = expanded ? 'min(86vh, 900px)' : 'min(78vh, 640px)';

  const statusLine = status === null
    ? 'Looking for your model…'
    : status.connected
      ? `${source === 'claude' ? 'Claude' : 'Local'} · ${model ? prettyModel(source, model) : '—'}`
      : 'No model connected';

  return (
    <div
      className="fixed bottom-5 right-5 z-[60] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
      style={{ width, height, background: NAVY, border: `1px solid ${GOLD}33`, color: '#e8ecf5' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: PANEL, borderBottom: `1px solid ${GOLD}22` }}>
        <RockwellOrb size={24} state={streaming ? 'thinking' : 'idle'} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight" style={{ color: '#fff' }}>Rockwell</div>
          <div className="text-[11px] leading-tight flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: status?.connected ? '#4ade80' : '#f59e0b', display: 'inline-block' }} />
            {statusLine}
          </div>
        </div>
        {owner && (
          <button onClick={() => setShowChats((v) => !v)} title="Chat history" className="p-1.5 rounded-md hover:bg-white/10"
            style={{ color: showChats ? GOLD : 'rgba(255,255,255,0.7)' }}>
            <MessagesSquareIcon size={16} />
          </button>
        )}
        <button onClick={newChat} title="New chat" className="p-1.5 rounded-md hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <SquarePenIcon size={16} />
        </button>
        <button onClick={() => setExpanded((e) => !e)} title={expanded ? 'Shrink' : 'Expand'} className="p-1.5 rounded-md hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {expanded ? <Minimize2Icon size={16} /> : <Maximize2Icon size={16} />}
        </button>
        <button onClick={() => setOpen(false)} title="Minimize" className="p-1.5 rounded-md hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <XIcon size={16} />
        </button>
      </div>

      {/* Model-source toggle + model dropdown */}
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: PANEL, borderBottom: `1px solid ${GOLD}14` }}>
        <span className="text-[10px] mr-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Model</span>
        {(['local', 'claude'] as ModelSource[]).map((s) => (
          <button
            key={s}
            onClick={() => switchSource(s)}
            disabled={streaming}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
            style={source === s
              ? { background: GOLD, color: NAVY }
              : { background: 'transparent', color: 'rgba(255,255,255,0.65)', border: `1px solid ${GOLD}33` }}
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
              : { background: 'transparent', color: 'rgba(255,255,255,0.65)', border: `1px solid ${GOLD}33` }}
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
            style={{ background: NAVY, color: '#e8ecf5', border: `1px solid ${GOLD}33`, maxWidth: 150 }}
          >
            {status.models.map((id) => (
              <option key={id} value={id} style={{ background: NAVY }}>{prettyModel(source, id)}</option>
            ))}
          </select>
        )}
      </div>

      {/* Chat history overlay (owner) */}
      {showChats && owner ? (
        <div className="flex-1 overflow-y-auto px-3 py-3" style={{ color: 'rgba(255,255,255,0.85)' }}>
          <button onClick={newChat}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium mb-3"
            style={{ background: GOLD, color: NAVY }}>
            <SquarePenIcon size={15} /> New chat
          </button>
          {chats.length === 0 ? (
            <p className="text-[12px] text-center mt-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
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
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(c.id); if (e.key === 'Escape') setRenamingId(null); }}
                        className="flex-1 rounded px-1.5 py-0.5 text-[13px]"
                        style={{ background: NAVY, border: `1px solid ${GOLD}55`, color: '#e8ecf5' }}
                      />
                      <button onClick={() => commitRename(c.id)} title="Save name" className="p-1 rounded hover:bg-white/10" style={{ color: GOLD }}>
                        <CheckIcon size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => openChat(c.id)} className="flex-1 min-w-0 text-left" title={c.title}>
                        <span className="block truncate text-[13px]" style={{ color: '#e8ecf5' }}>{c.title}</span>
                        <span className="block text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {c.updatedAt ? c.updatedAt.slice(0, 10) : ''}{c.source === 'claude' ? ' · Claude' : c.source === 'local' ? ' · Local' : ''}
                        </span>
                      </button>
                      <button onClick={() => { setRenamingId(c.id); setRenameDraft(c.title); }} title="Rename"
                        className="p-1 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        <PencilIcon size={13} />
                      </button>
                      <button onClick={() => removeChat(c.id)} title="Delete"
                        className="p-1 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        <Trash2Icon size={13} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : status !== null && !status.connected ? (
        /* Not connected → setup panel */
        <div className="flex-1 overflow-y-auto px-5 py-6" style={{ color: 'rgba(255,255,255,0.8)' }}>
          <div className="flex flex-col items-center text-center mb-5">
            <RockwellOrb size={44} />
            <h3 className="mt-3 text-base font-semibold" style={{ color: '#fff' }}>
              {source === 'claude' ? 'Connect your Claude subscription' : 'Bring your own model'}
            </h3>
            <p className="mt-1 text-[13px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {source === 'claude'
                ? 'Run the Rockwell bridge on your machine — it uses your Claude plan (no API key, no per-token cost).'
                : <>Rockwell runs on a model on <em>your</em> machine — nothing goes to a paid API. Set one up to start.</>}
            </p>
          </div>
          {source === 'claude' ? (
            <ol className="text-[13px] space-y-2.5 mb-5" style={{ color: 'rgba(255,255,255,0.8)' }}>
              <li><span style={{ color: GOLD }}>1.</span> Install Claude Code &amp; sign in: <code className="px-1 rounded" style={{ background: '#0009' }}>npm i -g @anthropic-ai/claude-code</code> then <code className="px-1 rounded" style={{ background: '#0009' }}>claude login</code></li>
              <li><span style={{ color: GOLD }}>2.</span> Start the bridge: <code className="px-1 rounded" style={{ background: '#0009' }}>cd rockwell-bridge</code> then <code className="px-1 rounded" style={{ background: '#0009' }}>node server.mjs</code></li>
              <li><span style={{ color: GOLD }}>3.</span> It listens on <code className="px-1 rounded" style={{ background: '#0009' }}>localhost:4025</code>.</li>
              <li><span style={{ color: GOLD }}>4.</span> Recheck below.</li>
            </ol>
          ) : (
            <ol className="text-[13px] space-y-2.5 mb-5" style={{ color: 'rgba(255,255,255,0.8)' }}>
              <li><span style={{ color: GOLD }}>1.</span> Install a local model runner — <a href="https://ollama.com" target="_blank" rel="noreferrer" style={{ color: GOLD }}>Ollama</a> is easiest.</li>
              <li><span style={{ color: GOLD }}>2.</span> Pull a model, e.g. <code className="px-1 rounded" style={{ background: '#0009' }}>ollama pull llama3.1</code></li>
              <li><span style={{ color: GOLD }}>3.</span> Allow this site to connect: set <code className="px-1 rounded" style={{ background: '#0009' }}>OLLAMA_ORIGINS</code> to include <code className="px-1 rounded" style={{ background: '#0009' }}>{window.location.origin}</code></li>
              <li><span style={{ color: GOLD }}>4.</span> Recheck below.</li>
            </ol>
          )}
          <label className="block text-[11px] mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {source === 'claude' ? 'Bridge URL' : 'Local model URL'}
          </label>
          <div className="flex gap-2 mb-3">
            <input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)}
              className="flex-1 rounded-md px-2.5 py-1.5 text-sm" style={{ background: NAVY, border: `1px solid ${GOLD}33`, color: '#e8ecf5' }} />
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
              style={{ color: 'rgba(255,255,255,0.6)' }}>
              <DownloadIcon size={15} /> Download Ollama
            </a>
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {status === null && (
              <div className="h-full flex items-center justify-center text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Looking for your model…
              </div>
            )}
            {status?.connected && messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <RockwellOrb size={40} />
                <p className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>Running on {source === 'claude' ? 'Claude' : 'your model'} — {model ? prettyModel(source, model) : '—'}.</p>
                <p className="mt-1 text-[12px]">Ask me anything.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                  style={m.role === 'user' ? { background: GOLD, color: NAVY } : { background: PANEL, color: '#e8ecf5', border: `1px solid ${GOLD}1a` }}>
                  {m.role === 'assistant' ? (
                    <div className="rw-md">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || '…'}</ReactMarkdown>
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 pt-1.5 text-[10px]" style={{ borderTop: `1px solid ${GOLD}22`, color: 'rgba(255,255,255,0.45)' }}>
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
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                disabled={!status?.connected}
                placeholder={status?.connected ? 'Ask Rockwell…' : 'Connect a model to chat'}
                className="flex-1 resize-none bg-transparent text-sm focus:outline-none"
                style={{ color: '#e8ecf5', maxHeight: 120 }}
              />
              {streaming ? (
                <button onClick={stop} title="Stop" className="p-1.5 rounded-lg" style={{ color: GOLD }}><StopCircleIcon size={20} /></button>
              ) : (
                <button onClick={send} disabled={!input.trim() || !status?.connected} title="Send" className="p-1.5 rounded-lg disabled:opacity-40" style={{ color: GOLD }}><SendIcon size={18} /></button>
              )}
            </div>
            <div className="text-[10px] text-center mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Your model, your machine · on {pageContext(location.pathname)} · Cmd/Ctrl+K to toggle
            </div>
          </div>
        </>
      )}
    </div>
  );
}
