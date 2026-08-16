import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderOpen, Network, X } from 'lucide-react';
import VaultPanel from './VaultPanel';
import NoteEditor from './NoteEditor';
import VaultGraph from './VaultGraph';
import VaultSearch from './VaultSearch';
import { vaultWrite, vaultDelete, vaultMove } from '../../lib/vault-api';

/**
 * Rockwell workspace — two-tab layout with a persistent search bar.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ [Vault] [Graph]            [ search…       ] │
 *   ├────────────┬─────────────────────────────────┤
 *   │ file tree  │  note viewer  /  graph          │
 *   └────────────┴─────────────────────────────────┘
 *
 * - The file tree is always visible in both tabs (public files for guests,
 *   public + private for authenticated users — enforced server-side).
 * - Vault tab: rendered note on the right (editable when authenticated).
 * - Graph tab: the knowledge graph on the right.
 * - Search works in both tabs; picking a result opens the note in Vault tab.
 * - No collapsing/expanding panels; the tree divider is simply resizable.
 */

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
  token: string | null;
}

const STORAGE_KEY = 'rockwell:shell:layout-v2';

type Tab = 'vault' | 'graph';

type LayoutState = {
  tab: Tab;
  treeWidth: number;
  selectedPath: string | null;
};

const DEFAULTS: LayoutState = {
  tab: 'vault',
  treeWidth: 260,
  selectedPath: null,
};

export default function WorkspaceShell({ token }: WorkspaceShellProps) {
  const isMobile = useIsMobile();
  const [state, setState] = useState<LayoutState>(DEFAULTS);
  const [refreshKey, setRefreshKey] = useState(0);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  // Load / persist layout (selectedPath intentionally not restored).
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

  // Tree divider drag.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      update({ treeWidth: Math.max(180, Math.min(480, d.startW + (e.clientX - d.startX))) });
    };
    const onUp = () => { dragRef.current = null; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [update]);

  const startDrag = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startW: state.treeWidth };
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  };

  /** Open a note: select it and jump to the Vault tab where the viewer lives. */
  const openNote = useCallback((path: string) => {
    update({ selectedPath: path, tab: 'vault' });
  }, [update]);

  /** Selecting in the tree keeps the current tab (in Graph tab it focuses the node). */
  const handleTreeSelect = useCallback((path: string) => {
    update({ selectedPath: path });
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
      openNote(path);
    } catch (e) { alert((e as Error).message); }
  }, [token, openNote]);

  const handleDelete = useCallback(async (path: string) => {
    if (!token) return;
    try {
      await vaultDelete(path, token);
      setRefreshKey((k) => k + 1);
      if (state.selectedPath === path) update({ selectedPath: null });
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
      if (hit) { openNote(hit.path); return; }
      if (!token) return;
      const create = window.confirm(`No note matches "${cleaned}". Create it?`);
      if (!create) return;
      const newPath = withExt.includes('/') ? withExt : `notes/${withExt}`;
      await handleCreate(newPath);
    } catch (e) { alert((e as Error).message); }
  }, [token, openNote, handleCreate]);

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

  const TabButton = ({ id, icon, label }: { id: Tab; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => update({ tab: id })}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] tracking-wider uppercase transition-colors ${
        state.tab === id
          ? 'bg-rw-gold/20 text-rw-gold'
          : 'text-rw-gold/60 hover:text-rw-gold hover:bg-rw-gold/5'
      }`}
    >
      {icon}<span>{label}</span>
    </button>
  );

  const tree = (
    <VaultPanel
      selectedPath={state.selectedPath}
      onSelect={handleTreeSelect}
      onCreate={handleCreate}
      onCreateFolder={handleCreateFolder}
      onDelete={handleDelete}
      onRename={handleRename}
      refreshKey={refreshKey}
      onRequestRefresh={() => setRefreshKey((k) => k + 1)}
      token={token}
    />
  );

  const topBar = (
    <div className="shrink-0 flex items-center gap-3 px-3 py-2 bg-rw-surface/70 border-b border-rw-gold/10">
      <div className="flex bg-rw-background/50 border border-rw-gold/15 rounded-lg overflow-hidden shrink-0">
        <TabButton id="vault" icon={<FolderOpen size={13} />} label="Vault" />
        <TabButton id="graph" icon={<Network size={13} />} label="Graph" />
      </div>
      <VaultSearch token={token} onSelect={openNote} />
    </div>
  );

  // ── Mobile layout: same two tabs; note opens as a bottom sheet ────────────
  if (isMobile) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {topBar}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {state.tab === 'vault' ? (
            <div className="h-full min-h-0">{tree}</div>
          ) : (
            <VaultGraph
              selectedPath={state.selectedPath}
              onSelect={(p) => update({ selectedPath: p })}
              refreshKey={refreshKey}
              token={token}
            />
          )}
          {state.selectedPath && (
            <div className="absolute inset-x-0 bottom-0 z-20 bg-rw-background border-t border-rw-gold/15 shadow-2xl flex flex-col" style={{ maxHeight: '70vh' }}>
              <div className="flex items-center justify-between px-4 py-2 border-b border-rw-gold/10 shrink-0">
                <span className="text-rw-gold text-xs font-medium truncate">
                  {state.selectedPath.split('/').pop()?.replace(/\.md$/, '')}
                </span>
                <button onClick={() => update({ selectedPath: null })} className="p-1 text-rw-gray/60 hover:text-rw-gold">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                <NoteEditor
                  path={state.selectedPath}
                  onSaved={() => setRefreshKey((k) => k + 1)}
                  onNavigateWiki={handleNavigateWiki}
                  token={token}
                  forcePreview={!token}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {topBar}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* File tree — always visible in both tabs */}
        <div style={{ width: state.treeWidth }} className="shrink-0 min-h-0">
          {tree}
        </div>
        <div
          onMouseDown={startDrag}
          className="w-1 cursor-col-resize bg-transparent hover:bg-rw-gold/20 transition-colors shrink-0"
        />

        {/* Right pane — note viewer or graph */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col relative">
          {state.tab === 'vault' ? (
            <NoteEditor
              path={state.selectedPath}
              onSaved={() => setRefreshKey((k) => k + 1)}
              onNavigateWiki={handleNavigateWiki}
              token={token}
              forcePreview={!token}
            />
          ) : (
            <VaultGraph
              selectedPath={state.selectedPath}
              onSelect={openNote}
              refreshKey={refreshKey}
              token={token}
            />
          )}
        </div>
      </div>
    </div>
  );
}
