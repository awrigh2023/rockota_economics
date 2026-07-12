import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import {
  File, FilePlus, FolderOpen, FolderPlus, Search, Trash2, RefreshCw, Pencil,
  Copy, Link2, ExternalLink,
} from 'lucide-react';
import { vaultList, VaultFile } from '../../lib/vault-api';

interface VaultPanelProps {
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onCreate: (path: string) => void;
  onCreateFolder: (folderPath: string) => void;
  onDelete: (path: string) => void;
  onRename: (from: string, to: string, isFolder?: boolean) => Promise<void>;
  refreshKey: number;
  onRequestRefresh: () => void;
  token: string | null;
}

const DRAG_MIME = 'application/rockwell-vault';
type DragPayload = { kind: 'file' | 'folder'; path: string };
type ContextTarget = { kind: 'file'; path: string } | { kind: 'folder'; path: string };
type ContextMenuState = { x: number; y: number; target: ContextTarget } | null;

function computeMoveTarget(
  payload: DragPayload,
  dropFolderPrefix: string,
): { to: string; isFolder: boolean } | null {
  const prefix = dropFolderPrefix.replace(/\/$/, '') + (dropFolderPrefix ? '/' : '');
  if (payload.kind === 'file') {
    const filename = payload.path.split('/').pop() || payload.path;
    const to = `${prefix}${filename}`;
    if (to === payload.path) return null;
    return { to, isFolder: false };
  }
  const fromNorm = payload.path.replace(/\/+$/, '') + '/';
  const folderName = fromNorm.replace(/\/$/, '').split('/').pop() || '';
  const to = `${prefix}${folderName}/`;
  if (to === fromNorm) return null;
  if (to.startsWith(fromNorm)) return null;
  return { to, isFolder: true };
}

function basename(p: string): string {
  return (p.split('/').pop() || p).replace(/\.md$/i, '');
}

async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch { /* fall through */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
}

export default function VaultPanel({
  selectedPath, onSelect, onCreate, onCreateFolder, onDelete, onRename,
  refreshKey, onRequestRefresh, token,
}: VaultPanelProps) {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(['']));
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ctx, setCtx] = useState<ContextMenuState>(null);
  const seededOpen = useRef(false);

  useEffect(() => {
    let abort = false;
    setLoading(true);
    setError(null);
    vaultList(token)
      .then((j) => { if (!abort) setFiles(j.files || []); })
      .catch((e) => { if (!abort) setError(String(e)); })
      .finally(() => { if (!abort) setLoading(false); });
    return () => { abort = true; };
  }, [refreshKey, token]);

  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    const closeKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtx(null); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', closeKey);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', closeKey); };
  }, [ctx]);

  const tree = useMemo(() => buildTree(files, filter), [files, filter]);

  // On first load, expand the scope groups ("My Notes" / "Public") so notes
  // are visible without an extra click. Seeds once so later refreshes don't
  // fight the user's collapse choices.
  useEffect(() => {
    if (seededOpen.current || files.length === 0) return;
    const roots = new Set<string>();
    for (const f of files) {
      const scope = scopeGroup(f.path);
      if (scope) roots.add(scope.root);
    }
    if (roots.size) {
      setOpenFolders((prev) => {
        const next = new Set(prev);
        roots.forEach((r) => next.add(r));
        return next;
      });
      seededOpen.current = true;
    }
  }, [files]);

  const performDrop = async (e: React.DragEvent, dropFolderPrefix: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    setIsDragging(false);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    let payload: DragPayload;
    try { payload = JSON.parse(raw); } catch { return; }
    const target = computeMoveTarget(payload, dropFolderPrefix);
    if (!target) return;
    try { await onRename(payload.path, target.to, target.isFolder); }
    catch (err) { alert((err as Error).message); }
  };

  const openContextMenu = (e: React.MouseEvent, target: ContextTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, target });
  };

  return (
    <aside className="flex flex-col h-full bg-rw-background border-r border-rw-gold/20">
      <div className="px-3 py-2 border-b border-rw-gold/10 flex items-center gap-2">
        <FolderOpen size={14} className="text-rw-gold/60" />
        <span className="text-[11px] tracking-widest uppercase text-rw-gold/80">Vault</span>
        <div className="flex-1" />
        <button className="p-1 rounded hover:bg-rw-gold/10 text-rw-gray hover:text-rw-gold transition-colors" title="Refresh" onClick={onRequestRefresh}>
          <RefreshCw size={13} />
        </button>
        {token && (
          <>
            <button
              className="p-1 rounded hover:bg-rw-gold/10 text-rw-gray hover:text-rw-gold transition-colors"
              title="New folder"
              onClick={() => {
                const name = window.prompt('New folder name (e.g. skills, notes/macro)');
                if (!name) return;
                const trimmed = name.replace(/^\/+|\/+$/g, '');
                if (!trimmed) return;
                onCreateFolder(trimmed);
              }}
            >
              <FolderPlus size={13} />
            </button>
            <button
              className="p-1 rounded hover:bg-rw-gold/10 text-rw-gray hover:text-rw-gold transition-colors"
              title="New note"
              onClick={() => {
                const name = window.prompt('New note (path, e.g. notes/economics.md)');
                if (!name) return;
                const path = name.endsWith('.md') ? name : `${name}.md`;
                onCreate(path);
              }}
            >
              <FilePlus size={13} />
            </button>
          </>
        )}
      </div>

      <div className="px-3 py-2 border-b border-rw-gold/10">
        <div className="flex items-center gap-2 bg-rw-surface-light/60 rounded px-2 py-1">
          <Search size={12} className="text-rw-gray/60" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="bg-transparent outline-none text-xs text-rw-foreground placeholder:text-rw-gray/50 w-full"
          />
        </div>
      </div>

      <div
        className={`flex-1 overflow-y-auto py-1 rw-scrollbar transition-colors ${
          isDragging && dragOverPath === '' ? 'bg-rw-gold/5 ring-1 ring-rw-gold/20 ring-inset' : ''
        }`}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDragOverPath('');
          setIsDragging(true);
        }}
        onDragLeave={() => setDragOverPath((cur) => (cur === '' ? null : cur))}
        onDrop={(e) => performDrop(e, '')}
      >
        {loading && <div className="px-3 py-2 text-xs text-rw-gray/60">Loading…</div>}
        {error && <div className="px-3 py-2 text-xs text-red-400">{error}</div>}
        {!loading && !error && files.length === 0 && (
          <div className="px-3 py-4 text-xs text-rw-gray/50 italic">
            No notes yet. {token ? <>Click <FilePlus size={11} className="inline" /> to create one.</> : 'Log in to create notes.'}
          </div>
        )}
        <FolderNode
          folder={tree}
          openFolders={openFolders}
          setOpenFolders={setOpenFolders}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
          onCreate={onCreate}
          onContextMenu={openContextMenu}
          dragOverPath={dragOverPath}
          setDragOverPath={setDragOverPath}
          setIsDragging={setIsDragging}
          performDrop={performDrop}
          depth={0}
          token={token}
        />
      </div>

      {ctx && (
        <ContextMenu
          state={ctx}
          onSelect={onSelect}
          onCreate={onCreate}
          onCreateFolder={onCreateFolder}
          onDelete={onDelete}
          onRename={onRename}
          onClose={() => setCtx(null)}
          token={token}
        />
      )}
    </aside>
  );
}

// ── Context menu ──────────────────────────────────────────────────────────

function ContextMenu({
  state, onSelect, onCreate, onCreateFolder, onDelete, onRename, onClose, token,
}: {
  state: NonNullable<ContextMenuState>;
  onSelect: (p: string) => void;
  onCreate: (p: string) => void;
  onCreateFolder: (p: string) => void;
  onDelete: (p: string) => void;
  onRename: (from: string, to: string, isFolder?: boolean) => Promise<void>;
  onClose: () => void;
  token: string | null;
}) {
  const { x, y, target } = state;
  const isFile = target.kind === 'file';
  const path = target.path;
  const cleanPath = isFile ? path : path.replace(/\/$/, '');

  const Item = ({ icon, label, onClick, danger }: {
    icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
  }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); onClose(); }}
      className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors ${
        danger ? 'text-red-400 hover:bg-red-400/10' : 'text-rw-foreground/90 hover:bg-rw-gold/10 hover:text-rw-gold'
      }`}
    >
      <span className={danger ? 'text-red-400' : 'text-rw-gold/60'}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div
      className="fixed z-50 min-w-[180px] rounded-md border border-rw-gold/20 bg-rw-surface/95 backdrop-blur shadow-xl py-1"
      style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 220) }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-2.5 py-1 text-[10px] uppercase tracking-widest text-rw-gray/60 truncate" title={path}>{cleanPath}</div>
      <div className="border-t border-rw-gold/10 my-0.5" />
      {isFile && <Item icon={<ExternalLink size={12} />} label="Open in editor" onClick={() => onSelect(path)} />}
      <Item icon={<Copy size={12} />} label="Copy path" onClick={() => copyToClipboard(cleanPath)} />
      <Item icon={<Link2 size={12} />} label="Copy as wikilink" onClick={() => {
        const name = isFile ? basename(path) : (path.replace(/\/$/, '').split('/').pop() || path);
        copyToClipboard(`[[${name}]]`);
      }} />
      {token && (
        <>
          <div className="border-t border-rw-gold/10 my-0.5" />
          {!isFile && <Item icon={<FilePlus size={12} />} label="New note here" onClick={() => {
            const base = window.prompt(`New note in "${path || '/'}":`, 'untitled.md');
            if (!base) return;
            const file = base.endsWith('.md') ? base : `${base}.md`;
            onCreate(`${path}${file}`);
          }} />}
          {!isFile && <Item icon={<FolderPlus size={12} />} label="New subfolder" onClick={() => {
            const name = window.prompt(`New subfolder in "${path || '/'}":`);
            if (!name) return;
            const trimmed = name.replace(/^\/+|\/+$/g, '');
            if (!trimmed) return;
            onCreateFolder(`${cleanPath}/${trimmed}`);
          }} />}
          <Item icon={<Pencil size={12} />} label="Rename" onClick={async () => {
            if (isFile) {
              const next = window.prompt('Rename to (full path):', path);
              if (!next || next === path) return;
              const to = next.endsWith('.md') ? next : `${next}.md`;
              try { await onRename(path, to, false); } catch (err) { alert((err as Error).message); }
            } else {
              const next = window.prompt('Rename folder to:', cleanPath);
              if (!next || next === cleanPath) return;
              const to = next.endsWith('/') ? next : `${next}/`;
              try { await onRename(path, to, true); } catch (err) { alert((err as Error).message); }
            }
          }} />
          {isFile && <Item icon={<Trash2 size={12} />} label="Delete" danger onClick={() => {
            if (window.confirm(`Delete ${path}?`)) onDelete(path);
          }} />}
        </>
      )}
    </div>
  );
}

// ── Tree building ─────────────────────────────────────────────────────────

type Folder = { name: string; path: string; files: VaultFile[]; folders: Folder[] };

/**
 * Map a blob path to its scope group: a friendly display label plus the true
 * prefix that should be hidden from the folder hierarchy. Keeps the real
 * parent folders (Rockota, Books, Libertas, …) at the top of each group while
 * the underlying folder.path stays the full blob prefix so rename/move/create
 * still operate on real paths.
 */
export function scopeGroup(path: string): { label: string; root: string } | null {
  if (path.startsWith('notes/public/')) return { label: 'Public', root: 'notes/public/' };
  const m = path.match(/^(notes\/users\/[^/]+\/)/);
  if (m) return { label: 'My Notes', root: m[1] };
  return null;
}

function buildTree(files: VaultFile[], filter: string): Folder {
  const root: Folder = { name: '', path: '', files: [], folders: [] };
  const lower = filter.trim().toLowerCase();
  for (const f of files) {
    if (lower && !f.path.toLowerCase().includes(lower) && !(f.title?.toLowerCase().includes(lower))) continue;

    let node = root;
    let acc = '';
    let segments: string[];

    const scope = scopeGroup(f.path);
    if (scope) {
      // Group under a scope node (name = label, path = true scope root) and
      // strip the prefix so the hierarchy starts at the real folders.
      let group = node.folders.find((c) => c.path === scope.root);
      if (!group) { group = { name: scope.label, path: scope.root, files: [], folders: [] }; node.folders.push(group); }
      node = group;
      acc = scope.root; // children accumulate their true full paths from here
      segments = f.path.slice(scope.root.length).split('/');
    } else {
      segments = f.path.split('/');
    }

    const fileName = segments.pop()!;
    for (const seg of segments) {
      if (!seg) continue; // skip empty segments from leading/trailing slashes
      acc += seg + '/';
      let child = node.folders.find((c) => c.name === seg);
      if (!child) { child = { name: seg, path: acc, files: [], folders: [] }; node.folders.push(child); }
      node = child;
    }
    node.files.push({ ...f, path: f.path });
    void fileName;
  }
  const sortFolder = (n: Folder) => {
    n.folders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    n.files.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    n.folders.forEach(sortFolder);
  };
  sortFolder(root);
  return root;
}

interface FolderNodeProps {
  folder: Folder;
  openFolders: Set<string>;
  setOpenFolders: (s: Set<string>) => void;
  selectedPath: string | null;
  onSelect: (p: string) => void;
  onDelete: (p: string) => void;
  onRename: (from: string, to: string, isFolder?: boolean) => Promise<void>;
  onCreate: (p: string) => void;
  onContextMenu: (e: React.MouseEvent, target: ContextTarget) => void;
  dragOverPath: string | null;
  setDragOverPath: Dispatch<SetStateAction<string | null>>;
  setIsDragging: (b: boolean) => void;
  performDrop: (e: React.DragEvent, prefix: string) => Promise<void>;
  depth: number;
  token: string | null;
}

function FolderNode({
  folder, openFolders, setOpenFolders, selectedPath, onSelect, onDelete, onRename, onCreate,
  onContextMenu, dragOverPath, setDragOverPath, setIsDragging, performDrop, depth, token,
}: FolderNodeProps) {
  const isRoot = folder.path === '';
  const isOpen = openFolders.has(folder.path);
  const isDropTarget = !isRoot && dragOverPath === folder.path;

  const toggle = () => {
    const next = new Set(openFolders);
    if (next.has(folder.path)) next.delete(folder.path); else next.add(folder.path);
    setOpenFolders(next);
  };

  const renameFolder = async () => {
    const trimmed = folder.path.replace(/\/$/, '');
    const next = window.prompt('Rename folder to:', trimmed);
    if (!next || next === trimmed) return;
    const to = next.endsWith('/') ? next : `${next}/`;
    try { await onRename(folder.path, to, true); } catch (e) { alert((e as Error).message); }
  };

  const newInFolder = () => {
    const base = window.prompt(`New note in "${folder.path || '/'}":`, 'untitled.md');
    if (!base) return;
    const file = base.endsWith('.md') ? base : `${base}.md`;
    onCreate(`${folder.path}${file}`);
  };

  const startDragFolder = (e: React.DragEvent) => {
    const payload: DragPayload = { kind: 'folder', path: folder.path };
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  return (
    <div>
      {!isRoot && (
        <div
          draggable
          onDragStart={startDragFolder}
          onDragEnd={() => { setIsDragging(false); setDragOverPath(null); }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
            e.preventDefault(); e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            setDragOverPath(folder.path);
          }}
          onDragLeave={(e) => { e.stopPropagation(); setDragOverPath((cur) => cur === folder.path ? null : cur); }}
          onDrop={(e) => performDrop(e, folder.path)}
          onContextMenu={(e) => onContextMenu(e, { kind: 'folder', path: folder.path })}
          className={`group w-full flex items-center gap-1.5 px-3 py-1 text-xs transition-colors cursor-pointer ${
            isDropTarget
              ? 'bg-rw-gold/20 text-rw-gold ring-1 ring-rw-gold/40 ring-inset'
              : 'text-rw-gray/80 hover:bg-rw-gold/5 hover:text-rw-gold'
          }`}
          style={{ paddingLeft: 12 + depth * 12 }}
          onClick={toggle}
        >
          <span className="text-[10px] text-rw-gray/50 w-2">{isOpen ? '▾' : '▸'}</span>
          <FolderOpen size={11} className={isDropTarget ? 'text-rw-gold' : 'text-rw-gold/50'} />
          <span className="truncate flex-1">{folder.name}</span>
          {token && (
            <>
              <button onClick={(e) => { e.stopPropagation(); newInFolder(); }} className="opacity-0 group-hover:opacity-100 hover:text-rw-gold transition-opacity" title="New note in folder"><FilePlus size={11} /></button>
              <button onClick={(e) => { e.stopPropagation(); renameFolder(); }} className="opacity-0 group-hover:opacity-100 hover:text-rw-gold transition-opacity" title="Rename folder"><Pencil size={11} /></button>
            </>
          )}
        </div>
      )}
      {(isRoot || isOpen) && (
        <>
          {folder.folders.map((sub) => (
            <FolderNode key={sub.path} folder={sub} openFolders={openFolders} setOpenFolders={setOpenFolders}
              selectedPath={selectedPath} onSelect={onSelect} onDelete={onDelete} onRename={onRename}
              onCreate={onCreate} onContextMenu={onContextMenu} dragOverPath={dragOverPath}
              setDragOverPath={setDragOverPath} setIsDragging={setIsDragging} performDrop={performDrop}
              depth={isRoot ? 0 : depth + 1} token={token} />
          ))}
          {folder.files.map((f) => {
            const selected = selectedPath === f.path;
            return (
              <div
                key={f.path}
                draggable
                onDragStart={(e) => {
                  const payload: DragPayload = { kind: 'file', path: f.path };
                  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
                  e.dataTransfer.effectAllowed = 'move';
                  setIsDragging(true);
                }}
                onDragEnd={() => { setIsDragging(false); setDragOverPath(null); }}
                onContextMenu={(e) => onContextMenu(e, { kind: 'file', path: f.path })}
                className={`group flex items-center gap-1.5 px-3 py-1 text-xs cursor-pointer transition-colors ${
                  selected ? 'bg-rw-gold/15 text-rw-gold' : 'text-rw-gray hover:bg-rw-gold/5 hover:text-rw-foreground'
                }`}
                style={{ paddingLeft: 12 + (isRoot ? 0 : (depth + 1)) * 12 }}
                onClick={() => onSelect(f.path)}
              >
                <File size={11} className={selected ? 'text-rw-gold' : 'text-rw-gray/40'} />
                <span className="truncate flex-1">{f.title || basename(f.path)}</span>
                {token && (
                  <>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const next = window.prompt('Rename to (full path):', f.path);
                        if (!next || next === f.path) return;
                        const to = next.endsWith('.md') ? next : `${next}.md`;
                        try { await onRename(f.path, to, false); } catch (err) { alert((err as Error).message); }
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-rw-gold transition-opacity"
                      title="Rename"
                    ><Pencil size={11} /></button>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete ${f.path}?`)) onDelete(f.path); }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                      title="Delete"
                    ><Trash2 size={11} /></button>
                  </>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
