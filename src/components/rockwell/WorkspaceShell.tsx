import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLeft, PanelLeftClose, PanelRight, PanelRightClose, MessageSquare, FilePen, Network, FolderOpen, X } from 'lucide-react';
import VaultPanel from './VaultPanel';
import NoteEditor from './NoteEditor';
import VaultGraph from './VaultGraph';
import { vaultWrite, vaultDelete, vaultMove } from '../../lib/vault-api';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

interface WorkspaceShellProps {
  chat: React.ReactNode;
  token: string | null;
}

const STORAGE_KEY = 'rockwell:shell:layout';

type LayoutState = {
  vaultWidth: number;
  graphWidth: number;
  guestNoteWidth: number;
  vaultOpen: boolean;
  graphOpen: boolean;
  centerOpen: boolean;
  centerView: 'chat' | 'editor';
  selectedPath: string | null;
};

const DEFAULTS: LayoutState = {
  vaultWidth: 240,
  graphWidth: 320,
  guestNoteWidth: 400,
  vaultOpen: true,
  graphOpen: true,
  centerOpen: true,
  centerView: 'chat',
  selectedPath: null,
};

export default function WorkspaceShell({ chat, token }: WorkspaceShellProps) {
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<'chat' | 'graph' | 'vault' | 'notes'>('chat');
  const [state, setState] = useState<LayoutState>(DEFAULTS);
  const [refreshKey, setRefreshKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ side: 'vault' | 'graph' | 'guestNote'; startX: number; startW: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState((s) => ({ ...s, ...parsed, selectedPath: null }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      const { selectedPath, ...persist } = state;
      void selectedPath;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
    } catch { /* ignore */ }
  }, [state]);

  const update = useCallback((patch: Partial<LayoutState>) => setState((s) => ({ ...s, ...patch })), []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      if (d.side === 'vault') update({ vaultWidth: Math.max(160, Math.min(480, d.startW + dx)) });
      else if (d.side === 'graph') update({ graphWidth: Math.max(220, Math.min(640, d.startW - dx)) });
      else update({ guestNoteWidth: Math.max(280, Math.min(760, d.startW - dx)) });
    };
    const onUp = () => { dragRef.current = null; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [update]);

  const startDrag = (side: 'vault' | 'graph' | 'guestNote', e: React.MouseEvent) => {
    const startW = side === 'vault' ? state.vaultWidth : side === 'graph' ? state.graphWidth : state.guestNoteWidth;
    dragRef.current = { side, startX: e.clientX, startW };
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  };

  const handleSelect = useCallback((path: string) => {
    update({ selectedPath: path, centerView: 'editor' });
  }, [update]);

  const handleCreateFolder = useCallback(async (folderPath: string) => {
    if (!token) return;
    const norm = folderPath.replace(/^\/+|\/+$/g, '');
    const indexPath = `${norm}/index.md`;
    const baseName = norm.split('/').pop() || norm;
    try {
      await vaultWrite(indexPath, `# ${baseName}\n\nFolder placeholder. Edit, rename, or delete this file.\n`, token, false);
      setRefreshKey((k) => k + 1);
    } catch (e) { alert((e as Error).message); }
  }, [token]);

  const handleCreate = useCallback(async (path: string) => {
    if (!token) return;
    try {
      await vaultWrite(path, `# ${path.split('/').pop()?.replace(/\.md$/i, '') || 'New note'}\n\n`, token, false);
      setRefreshKey((k) => k + 1);
      update({ selectedPath: path, centerView: 'editor' });
    } catch (e) { alert((e as Error).message); }
  }, [token, update]);

  const handleDelete = useCallback(async (path: string) => {
    if (!token) return;
    try {
      await vaultDelete(path, token);
      setRefreshKey((k) => k + 1);
      if (state.selectedPath === path) update({ selectedPath: null, centerView: 'chat' });
    } catch (e) { alert((e as Error).message); }
  }, [token, state.selectedPath, update]);

  const handleNavigateWiki = useCallback(async (target: string) => {
    const cleaned = target.trim();
    if (!cleaned) return;
    try {
      const { vaultList } = await import('../../lib/vault-api');
      const j = await vaultList(token);
      const files = j.files || [];
      const withExt = cleaned.endsWith('.md') ? cleaned : `${cleaned}.md`;
      let hit = files.find((f) => f.path === withExt || f.path === cleaned);
      if (!hit) {
        const bn = (cleaned.split('/').pop() || cleaned).replace(/\.md$/i, '').toLowerCase();
        hit = files.find((f) => (f.path.split('/').pop() || f.path).replace(/\.md$/i, '').toLowerCase() === bn);
      }
      if (hit) { update({ selectedPath: hit.path, centerView: 'editor' }); return; }
      if (!token) return;
      const create = window.confirm(`No note matches "${cleaned}". Create it?`);
      if (!create) return;
      const newPath = withExt.includes('/') ? withExt : `notes/${withExt}`;
      await handleCreate(newPath);
    } catch (e) { alert((e as Error).message); }
  }, [token, update, handleCreate]);

  const handleRename = useCallback(async (from: string, to: string, isFolder?: boolean) => {
    if (!token) return;
    try {
      await vaultMove(from, to, token, !!isFolder);
      setRefreshKey((k) => k + 1);
      if (!isFolder && state.selectedPath === from) update({ selectedPath: to });
      else if (isFolder && state.selectedPath?.startsWith(from)) {
        update({ selectedPath: state.selectedPath.replace(from, to) });
      }
    } catch (e) { throw e; }
  }, [token, state.selectedPath, update]);

  const TabButton = ({ active, onClick, disabled, icon, label, title }: {
    active: boolean; onClick: () => void; disabled?: boolean; icon: React.ReactNode; label: string; title?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] tracking-wider uppercase transition-colors ${
        active ? 'bg-rw-gold/20 text-rw-gold' : 'text-rw-gold/60 hover:text-rw-gold hover:bg-rw-gold/5 disabled:text-rw-gray/25 disabled:hover:bg-transparent disabled:cursor-not-allowed'
      }`}
    >
      {icon}<span>{label}</span>
    </button>
  );

  // ── Mobile guest layout ─────────────────────────────────────────────────────
  if (isMobile && !token) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 relative">
          <VaultGraph
            selectedPath={state.selectedPath}
            onSelect={handleSelect}
            refreshKey={refreshKey}
            token={null}
          />
        </div>
        {state.selectedPath && (
          <div className="absolute inset-x-0 bottom-0 z-20 bg-rw-background border-t border-rw-gold/15 shadow-2xl flex flex-col" style={{ maxHeight: '65vh' }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-rw-gold/10 shrink-0">
              <span className="text-rw-gold text-xs font-medium truncate">{state.selectedPath.split('/').pop()?.replace(/\.md$/, '')}</span>
              <button onClick={() => update({ selectedPath: null })} className="p-1 text-rw-gray/60 hover:text-rw-gold">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <NoteEditor path={state.selectedPath} onNavigateWiki={handleNavigateWiki} token={null} forcePreview />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Mobile auth layout ──────────────────────────────────────────────────────
  if (isMobile && token) {
    const tabs = [
      { id: 'chat' as const, icon: <MessageSquare size={18} />, label: 'Chat' },
      { id: 'graph' as const, icon: <Network size={18} />, label: 'Graph' },
      { id: 'vault' as const, icon: <FolderOpen size={18} />, label: 'Vault' },
      { id: 'notes' as const, icon: <FilePen size={18} />, label: 'Notes', disabled: !state.selectedPath },
    ];
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden">
          {mobileTab === 'chat' && <div className="flex flex-col h-full min-h-0">{chat}</div>}
          {mobileTab === 'graph' && (
            <VaultGraph
              selectedPath={state.selectedPath}
              onSelect={(path) => { handleSelect(path); setMobileTab('notes'); }}
              refreshKey={refreshKey}
              token={token}
            />
          )}
          {mobileTab === 'vault' && (
            <VaultPanel
              selectedPath={state.selectedPath}
              onSelect={(path) => { handleSelect(path); setMobileTab('notes'); }}
              onCreate={handleCreate}
              onCreateFolder={handleCreateFolder}
              onDelete={handleDelete}
              onRename={handleRename}
              refreshKey={refreshKey}
              onRequestRefresh={() => setRefreshKey((k) => k + 1)}
              token={token}
            />
          )}
          {mobileTab === 'notes' && (
            <NoteEditor
              path={state.selectedPath}
              onSaved={() => setRefreshKey((k) => k + 1)}
              onNavigateWiki={handleNavigateWiki}
              token={token}
            />
          )}
        </div>
        <nav className="shrink-0 flex border-t border-rw-gold/15 bg-rw-surface">
          {tabs.map((t) => (
            <button
              key={t.id}
              disabled={t.disabled}
              onClick={() => !t.disabled && setMobileTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                mobileTab === t.id ? 'text-rw-gold' : t.disabled ? 'text-rw-gray/25' : 'text-rw-gray/60 hover:text-rw-gold'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    );
  }

  // ── Desktop guest layout: graph fills left, note panel slides in on the right ──
  if (!token) {
    return (
      <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 min-h-0 relative">
          <VaultGraph
            selectedPath={state.selectedPath}
            onSelect={handleSelect}
            refreshKey={refreshKey}
            token={null}
          />
          {state.selectedPath && (
            <button
              onClick={() => update({ selectedPath: null })}
              className="absolute top-2 right-2 z-10 p-1.5 rounded bg-rw-surface/70 hover:bg-rw-gold/10 text-rw-gold/70 hover:text-rw-gold border border-rw-gold/15 transition-colors"
              title="Close note"
            >
              <PanelRightClose size={14} />
            </button>
          )}
        </div>

        {state.selectedPath && (
          <>
            <div
              onMouseDown={(e) => startDrag('guestNote', e)}
              className="w-1 cursor-col-resize bg-transparent hover:bg-rw-gold/20 transition-colors shrink-0"
            />
            <div
              style={{ width: state.guestNoteWidth }}
              className="shrink-0 min-h-0 flex flex-col border-l border-rw-gold/10 bg-rw-background"
            >
              <NoteEditor
                path={state.selectedPath}
                onNavigateWiki={handleNavigateWiki}
                token={null}
                forcePreview
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Desktop authenticated layout ────────────────────────────────────────────
  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
      {state.vaultOpen && (
        <div style={{ width: state.vaultWidth }} className="shrink-0 min-h-0">
          <VaultPanel
            selectedPath={state.selectedPath}
            onSelect={handleSelect}
            onCreate={handleCreate}
            onCreateFolder={handleCreateFolder}
            onDelete={handleDelete}
            onRename={handleRename}
            refreshKey={refreshKey}
            onRequestRefresh={() => setRefreshKey((k) => k + 1)}
            token={token}
          />
        </div>
      )}
      {state.vaultOpen && (
        <div onMouseDown={(e) => startDrag('vault', e)} className="w-1 cursor-col-resize bg-transparent hover:bg-rw-gold/20 transition-colors" />
      )}

      {/* Center panel — chat / note editor */}
      {state.centerOpen && (
        <div className="flex-1 min-w-0 flex flex-col min-h-0 relative">
          <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
            <button
              onClick={() => update({ vaultOpen: !state.vaultOpen })}
              className="p-1.5 rounded bg-rw-surface/70 hover:bg-rw-gold/10 text-rw-gold/70 hover:text-rw-gold border border-rw-gold/15 transition-colors"
              title={state.vaultOpen ? 'Hide vault' : 'Show vault'}
            >
              {state.vaultOpen ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
            </button>
            <div className="flex bg-rw-surface/70 border border-rw-gold/15 rounded overflow-hidden">
              <TabButton active={state.centerView === 'chat'} onClick={() => update({ centerView: 'chat' })} icon={<MessageSquare size={12} />} label="Chat" />
              <TabButton
                active={state.centerView === 'editor'}
                onClick={() => update({ centerView: 'editor' })}
                disabled={!state.selectedPath}
                icon={<FilePen size={12} />}
                label="Notes"
                title={state.selectedPath ? 'Open editor' : 'Select a note first'}
              />
            </div>
            <button
              onClick={() => update({ graphOpen: !state.graphOpen })}
              className="p-1.5 rounded bg-rw-surface/70 hover:bg-rw-gold/10 text-rw-gold/70 hover:text-rw-gold border border-rw-gold/15 transition-colors"
              title={state.graphOpen ? 'Hide graph' : 'Show graph'}
            >
              {state.graphOpen ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
            </button>
            <button
              onClick={() => update({ centerOpen: false })}
              className="p-1.5 rounded bg-rw-surface/70 hover:bg-rw-gold/10 text-rw-gold/70 hover:text-rw-gold border border-rw-gold/15 transition-colors"
              title="Collapse to vault + graph view"
            >
              <X size={14} />
            </button>
          </div>

          {state.centerView === 'chat' || !state.selectedPath ? (
            <div className="flex-1 min-h-0 flex flex-col">{chat}</div>
          ) : (
            <NoteEditor
              path={state.selectedPath}
              onSaved={() => setRefreshKey((k) => k + 1)}
              onNavigateWiki={handleNavigateWiki}
              token={token}
            />
          )}
        </div>
      )}

      {state.graphOpen && state.centerOpen && (
        <div onMouseDown={(e) => startDrag('graph', e)} className="w-1 cursor-col-resize bg-transparent hover:bg-rw-gold/20 transition-colors" />
      )}
      {state.graphOpen && (
        <div
          style={state.centerOpen ? { width: state.graphWidth } : undefined}
          className={`${state.centerOpen ? 'shrink-0' : 'flex-1'} min-h-0 relative`}
        >
          <VaultGraph
            selectedPath={state.selectedPath}
            onSelect={handleSelect}
            refreshKey={refreshKey}
            token={token}
          />
          {/* Re-open center panel button — floats on graph when center is hidden */}
          {!state.centerOpen && (
            <button
              onClick={() => update({ centerOpen: true })}
              className="absolute top-2 left-2 z-10 p-1.5 rounded bg-rw-surface/70 hover:bg-rw-gold/10 text-rw-gold/70 hover:text-rw-gold border border-rw-gold/15 transition-colors"
              title="Show chat / notes panel"
            >
              <PanelLeft size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
