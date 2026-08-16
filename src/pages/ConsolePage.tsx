import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboardIcon,
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  CalendarIcon,
  StickyNoteIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircle2Icon,
  CircleIcon,
  CircleDotIcon,
  EyeOffIcon,
  EyeIcon,
  DatabaseIcon,
  Share2Icon,
  FileTextIcon,
  FlameIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { vaultList, vaultGraph, VaultFile } from '../lib/vault-api';
import {
  Board,
  Bucket,
  Task,
  Status,
  Priority,
  STATUS_LABEL,
  PRIORITY_LABEL,
  loadBoard,
  saveBoard,
  defaultBoard,
  newId,
} from '../lib/console';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function dueTone(due: string | null, status: Status): string {
  if (!due || status === 'done') return 'text-gray-400';
  const t = todayStr();
  if (due < t) return 'text-red-600 font-medium';
  if (due === t) return 'text-amber-600 font-medium';
  return 'text-gray-400';
}

const PRIORITY_ACCENT: Record<Priority, string> = {
  none: 'border-l-gray-200',
  low: 'border-l-sky-300',
  med: 'border-l-[#d7c770]',
  high: 'border-l-red-400',
};

const STATUS_ICON: Record<Status, typeof CircleIcon> = {
  todo: CircleIcon,
  doing: CircleDotIcon,
  done: CheckCircle2Icon,
};

// ---------------------------------------------------------------------------
// Vault pulse — the vault is the brains behind Rockota; surface it here.
// ---------------------------------------------------------------------------

interface VaultPulse {
  total: number;
  touchedWeek: number;
  hottestArea: string | null;
  links: number;
}

function topAreaOf(files: VaultFile[]): string | null {
  // Group by the segment after notes/users/{key}/ or notes/public/
  const counts = new Map<string, number>();
  for (const f of files) {
    const segs = f.path.split('/');
    // notes/public/X/... → X ; notes/users/andrew/X/... → X
    const area = segs[1] === 'public' ? segs[2] : segs[3];
    if (!area || area.endsWith('.md')) continue;
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [area, n] of counts) {
    if (n > bestN) { best = area; bestN = n; }
  }
  return best;
}

function VaultPulseStrip({ token }: { token: string }) {
  const [pulse, setPulse] = useState<VaultPulse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([vaultList(token), vaultGraph(token).catch(() => null)])
      .then(([list, graph]) => {
        if (cancelled) return;
        const files = list.files ?? [];
        const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        setPulse({
          total: files.length,
          touchedWeek: files.filter((f) => (f.updatedAt ?? '') >= weekAgo).length,
          hottestArea: topAreaOf(files),
          links: graph ? (graph.edges?.length ?? 0) : 0,
        });
      })
      .catch(() => !cancelled && setError(true));
    return () => { cancelled = true; };
  }, [token]);

  if (error) return null; // pulse is decoration, never in the way

  const items: { icon: typeof DatabaseIcon; label: string; value: string }[] = pulse
    ? [
        { icon: FileTextIcon, label: 'Notes in the vault', value: pulse.total.toLocaleString() },
        { icon: FlameIcon, label: 'Touched in last 7 days', value: String(pulse.touchedWeek) },
        { icon: DatabaseIcon, label: 'Most active area', value: pulse.hottestArea ?? '—' },
        { icon: Share2Icon, label: 'Wikilink connections', value: pulse.links.toLocaleString() },
      ]
    : [];

  return (
    <div className="bg-[#243975] rounded-lg px-5 py-4 mb-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          {pulse ? (
            items.map((it) => (
              <div key={it.label} className="flex items-center gap-2.5">
                <it.icon size={18} className="text-[#d7c770]" />
                <div>
                  <div className="text-lg font-semibold leading-tight">{it.value}</div>
                  <div className="text-[11px] text-white/60 uppercase tracking-wide">{it.label}</div>
                </div>
              </div>
            ))
          ) : (
            <span className="text-sm text-white/60">Reading the vault…</span>
          )}
        </div>
        <Link
          to="/rockwell"
          className="text-xs font-medium text-[#d7c770] hover:text-white whitespace-nowrap"
        >
          Open the vault →
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task card + editor
// ---------------------------------------------------------------------------

interface CardProps {
  task: Task;
  onEdit: () => void;
  onCycleStatus: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

function TaskCard({ task, onEdit, onCycleStatus, onDragStart }: CardProps) {
  const Icon = STATUS_ICON[task.status];
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`bg-white rounded-md border border-gray-200 border-l-4 ${PRIORITY_ACCENT[task.priority]} px-3 py-2.5 shadow-sm hover:shadow cursor-grab active:cursor-grabbing group`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={onCycleStatus}
          title={`${STATUS_LABEL[task.status]} — click to advance`}
          className={`mt-0.5 shrink-0 ${task.status === 'done' ? 'text-[#008080]' : task.status === 'doing' ? 'text-[#243975]' : 'text-gray-300 hover:text-gray-400'}`}
        >
          <Icon size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-snug ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-3 mt-1">
            {task.due && (
              <span className={`inline-flex items-center gap-1 text-[11px] ${dueTone(task.due, task.status)}`}>
                <CalendarIcon size={11} />
                {task.due}
              </span>
            )}
            {task.priority !== 'none' && (
              <span className="text-[11px] text-gray-400">{PRIORITY_LABEL[task.priority]}</span>
            )}
            {task.notes && <StickyNoteIcon size={11} className="text-gray-300" />}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-[#243975] shrink-0"
        >
          <PencilIcon size={14} />
        </button>
      </div>
    </div>
  );
}

interface EditorProps {
  task: Task;
  buckets: Bucket[];
  onSave: (t: Task) => void;
  onDelete: () => void;
  onClose: () => void;
}

function TaskEditor({ task, buckets, onSave, onDelete, onClose }: EditorProps) {
  const [draft, setDraft] = useState<Task>(task);
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          className="w-full text-base font-medium text-gray-900 border-b border-gray-200 pb-2 mb-4 focus:border-[#243975] focus:outline-none"
          placeholder="Task title"
        />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="text-xs text-gray-500">
            Bucket
            <select value={draft.bucketId} onChange={(e) => set('bucketId', e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800">
              {buckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-500">
            Status
            <select value={draft.status} onChange={(e) => set('status', e.target.value as Status)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800">
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-500">
            Due date
            <input type="date" value={draft.due ?? ''} onChange={(e) => set('due', e.target.value || null)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800" />
          </label>
          <label className="text-xs text-gray-500">
            Priority
            <select value={draft.priority} onChange={(e) => set('priority', e.target.value as Priority)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800">
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-xs text-gray-500 block mb-4">
          Notes
          <textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800 resize-y"
            placeholder="Details, links, context…" />
        </label>
        <div className="flex items-center justify-between">
          <button onClick={onDelete} className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700">
            <Trash2Icon size={15} /> Delete
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancel</button>
            <button
              onClick={() => draft.title.trim() && onSave({ ...draft, updatedAt: new Date().toISOString() })}
              className="px-4 py-1.5 text-sm font-medium text-white bg-[#243975] rounded-md hover:bg-[#1c2e5e]"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bucket column
// ---------------------------------------------------------------------------

interface ColumnProps {
  bucket: Bucket;
  tasks: Task[];
  hideDone: boolean;
  isFirst: boolean;
  isLast: boolean;
  onAddTask: (title: string) => void;
  onEditTask: (t: Task) => void;
  onCycleStatus: (t: Task) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onDropTask: (taskId: string) => void;
}

function BucketColumn(props: ColumnProps) {
  const { bucket, tasks, hideDone, isFirst, isLast } = props;
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(bucket.name);
  const [dragOver, setDragOver] = useState(false);

  const visible = hideDone ? tasks.filter((t) => t.status !== 'done') : tasks;
  const openCount = tasks.filter((t) => t.status !== 'done').length;

  function submitAdd() {
    const t = newTitle.trim();
    if (t) props.onAddTask(t);
    setNewTitle('');
    setAdding(false);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData('text/task-id');
        if (id) props.onDropTask(id);
      }}
      className={`flex flex-col w-72 shrink-0 rounded-lg border ${dragOver ? 'border-[#008080] bg-[#008080]/5' : 'border-gray-200 bg-gray-100/60'} max-h-[70vh]`}
    >
      {/* Column header */}
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { setRenaming(false); if (name.trim() && name !== bucket.name) props.onRename(name.trim()); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setName(bucket.name); setRenaming(false); } }}
            className="flex-1 text-sm font-semibold text-[#243975] bg-white rounded px-1.5 py-0.5 border border-[#243975]/40 focus:outline-none"
          />
        ) : (
          <button onDoubleClick={() => setRenaming(true)} onClick={() => setRenaming(true)}
            title="Click to rename" className="flex-1 text-left text-sm font-semibold text-[#243975] truncate">
            {bucket.name}
          </button>
        )}
        <span className="text-[11px] text-gray-400 tabular-nums">{openCount}</span>
        <button onClick={() => props.onMove(-1)} disabled={isFirst}
          className="text-gray-300 hover:text-gray-500 disabled:opacity-30"><ChevronLeftIcon size={14} /></button>
        <button onClick={() => props.onMove(1)} disabled={isLast}
          className="text-gray-300 hover:text-gray-500 disabled:opacity-30"><ChevronRightIcon size={14} /></button>
        <button onClick={props.onDelete} title="Delete bucket"
          className="text-gray-300 hover:text-red-500"><Trash2Icon size={14} /></button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-2 space-y-2">
        {visible.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            onEdit={() => props.onEditTask(t)}
            onCycleStatus={() => props.onCycleStatus(t)}
            onDragStart={(e) => e.dataTransfer.setData('text/task-id', t.id)}
          />
        ))}
        {visible.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">Nothing here.</p>
        )}
      </div>

      {/* Add task */}
      <div className="px-2.5 pb-2.5">
        {adding ? (
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={submitAdd}
            onKeyDown={(e) => { if (e.key === 'Enter') submitAdd(); if (e.key === 'Escape') { setNewTitle(''); setAdding(false); } }}
            placeholder="Task title, Enter to add"
            className="w-full rounded-md border border-[#008080]/50 px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#008080]"
          />
        ) : (
          <button onClick={() => setAdding(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 py-1.5 text-xs text-gray-500 hover:border-[#008080] hover:text-[#008080]">
            <PlusIcon size={13} /> Add task
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ConsolePage = () => {
  const { token, user } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [editing, setEditing] = useState<Task | null>(null);
  const [hideDone, setHideDone] = useState(false);
  const [addingBucket, setAddingBucket] = useState(false);
  const [bucketName, setBucketName] = useState('');

  // Debounced autosave
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = useCallback((b: Board) => {
    if (!token) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      saveBoard(b, token)
        .then(() => setSaveState('idle'))
        .catch(() => setSaveState('error'));
    }, 600);
  }, [token]);

  const update = useCallback((fn: (b: Board) => Board) => {
    setBoard((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    loadBoard(token)
      .then((b) => {
        if (cancelled) return;
        if (b) { setBoard(b); }
        else {
          const seeded = defaultBoard();
          setBoard(seeded);
          // First run: persist the seed so the vault file exists.
          saveBoard(seeded, token).catch(() => setSaveState('error'));
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [token]);

  const tasksByBucket = useMemo(() => {
    const map = new Map<string, Task[]>();
    if (!board) return map;
    for (const b of board.buckets) map.set(b.id, []);
    const sorted = [...board.tasks].sort((a, z) => a.order - z.order || a.createdAt.localeCompare(z.createdAt));
    for (const t of sorted) map.get(t.bucketId)?.push(t);
    return map;
  }, [board]);

  const openTotal = board?.tasks.filter((t) => t.status !== 'done').length ?? 0;
  const dueSoon = board?.tasks.filter((t) => t.status !== 'done' && t.due && t.due <= todayStr()).length ?? 0;

  // ── Mutations ──────────────────────────────────────────────────────────────

  function addTask(bucketId: string, title: string) {
    update((b) => {
      const now = new Date().toISOString();
      const maxOrder = Math.max(0, ...b.tasks.filter((t) => t.bucketId === bucketId).map((t) => t.order));
      const task: Task = {
        id: newId('t'), title, bucketId, status: 'todo', priority: 'none',
        due: null, notes: '', order: maxOrder + 1, createdAt: now, updatedAt: now,
      };
      return { ...b, tasks: [...b.tasks, task] };
    });
  }

  function saveTask(t: Task) {
    update((b) => ({ ...b, tasks: b.tasks.map((x) => (x.id === t.id ? t : x)) }));
    setEditing(null);
  }

  function deleteTask(id: string) {
    update((b) => ({ ...b, tasks: b.tasks.filter((x) => x.id !== id) }));
    setEditing(null);
  }

  function cycleStatus(t: Task) {
    const next: Status = t.status === 'todo' ? 'doing' : t.status === 'doing' ? 'done' : 'todo';
    update((b) => ({
      ...b,
      tasks: b.tasks.map((x) => (x.id === t.id ? { ...x, status: next, updatedAt: new Date().toISOString() } : x)),
    }));
  }

  function moveTaskToBucket(taskId: string, bucketId: string) {
    update((b) => {
      const maxOrder = Math.max(0, ...b.tasks.filter((t) => t.bucketId === bucketId).map((t) => t.order));
      return {
        ...b,
        tasks: b.tasks.map((t) =>
          t.id === taskId ? { ...t, bucketId, order: maxOrder + 1, updatedAt: new Date().toISOString() } : t,
        ),
      };
    });
  }

  function addBucket(name: string) {
    update((b) => ({ ...b, buckets: [...b.buckets, { id: newId('b'), name }] }));
  }

  function renameBucket(id: string, name: string) {
    update((b) => ({ ...b, buckets: b.buckets.map((x) => (x.id === id ? { ...x, name } : x)) }));
  }

  function deleteBucket(id: string) {
    if (!board) return;
    const n = board.tasks.filter((t) => t.bucketId === id).length;
    if (n > 0 && !window.confirm(`Delete this bucket and its ${n} task${n === 1 ? '' : 's'}?`)) return;
    update((b) => ({
      ...b,
      buckets: b.buckets.filter((x) => x.id !== id),
      tasks: b.tasks.filter((t) => t.bucketId !== id),
    }));
  }

  function moveBucket(id: string, dir: -1 | 1) {
    update((b) => {
      const i = b.buckets.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= b.buckets.length) return b;
      const buckets = [...b.buckets];
      [buckets[i], buckets[j]] = [buckets[j], buckets[i]];
      return { ...b, buckets };
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading || !board) {
    return <div className="w-full min-h-[60vh] flex items-center justify-center text-gray-500">Loading your console…</div>;
  }

  return (
    <div className="w-full min-h-[70vh] bg-gray-50 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#243975]/10 p-3 rounded-full">
              <LayoutDashboardIcon size={26} className="text-[#243975]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#243975]">Rockwell Console</h1>
              <p className="text-sm text-gray-500">
                {user?.email} · {openTotal} open task{openTotal === 1 ? '' : 's'}
                {dueSoon > 0 && <span className="text-amber-600"> · {dueSoon} due now</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs ${saveState === 'error' ? 'text-red-500' : 'text-gray-400'}`}>
              {saveState === 'saving' ? 'Saving to vault…' : saveState === 'error' ? 'Save failed — retry by making a change' : 'Saved to vault'}
            </span>
            <button onClick={() => setHideDone((h) => !h)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
              {hideDone ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
              {hideDone ? 'Show done' : 'Hide done'}
            </button>
          </div>
        </div>

        {/* Vault pulse — the brains behind Rockota */}
        {token && <VaultPulseStrip token={token} />}

        {/* Board */}
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {board.buckets.map((bk, i) => (
            <BucketColumn
              key={bk.id}
              bucket={bk}
              tasks={tasksByBucket.get(bk.id) ?? []}
              hideDone={hideDone}
              isFirst={i === 0}
              isLast={i === board.buckets.length - 1}
              onAddTask={(title) => addTask(bk.id, title)}
              onEditTask={setEditing}
              onCycleStatus={cycleStatus}
              onRename={(name) => renameBucket(bk.id, name)}
              onDelete={() => deleteBucket(bk.id)}
              onMove={(dir) => moveBucket(bk.id, dir)}
              onDropTask={(taskId) => moveTaskToBucket(taskId, bk.id)}
            />
          ))}

          {/* Add bucket */}
          <div className="w-72 shrink-0">
            {addingBucket ? (
              <input
                autoFocus
                value={bucketName}
                onChange={(e) => setBucketName(e.target.value)}
                onBlur={() => { if (bucketName.trim()) addBucket(bucketName.trim()); setBucketName(''); setAddingBucket(false); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') { setBucketName(''); setAddingBucket(false); }
                }}
                placeholder="Bucket name, Enter to add"
                className="w-full rounded-lg border border-[#008080]/50 px-3 py-2.5 text-sm focus:outline-none focus:border-[#008080]"
              />
            ) : (
              <button onClick={() => setAddingBucket(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2.5 text-sm text-gray-500 hover:border-[#008080] hover:text-[#008080]">
                <PlusIcon size={15} /> New bucket
              </button>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <TaskEditor
          task={editing}
          buckets={board.buckets}
          onSave={saveTask}
          onDelete={() => deleteTask(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default ConsolePage;
