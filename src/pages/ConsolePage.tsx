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
  TargetIcon,
  MinusIcon,
  FlagIcon,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../context/AuthContext';
import { vaultList, vaultGraph, VaultFile } from '../lib/vault-api';
import {
  Board,
  Bucket,
  Task,
  Goal,
  Horizon,
  Status,
  Priority,
  STATUS_LABEL,
  PRIORITY_LABEL,
  HORIZON_LABEL,
  HORIZONS,
  loadBoard,
  saveBoard,
  defaultBoard,
  newId,
  newGoal,
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
  if (due === t) return 'text-amber-700 font-medium';
  return 'text-gray-500';
}

const PRIORITY_ACCENT: Record<Priority, string> = {
  none: 'border-l-gray-300',
  low: 'border-l-sky-400',
  med: 'border-l-[#9fb98f]',
  high: 'border-l-red-500',
};

const STATUS_ICON: Record<Status, typeof CircleIcon> = {
  todo: CircleIcon,
  doing: CircleDotIcon,
  done: CheckCircle2Icon,
};

// A reusable retro Mac window frame with a pinstripe title bar.
function MacWindow({
  title,
  tone = 'navy',
  right,
  className = '',
  children,
}: {
  title: React.ReactNode;
  tone?: 'navy' | 'sage' | 'teal';
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const bar =
    tone === 'sage' ? 'mac-titlebar mac-titlebar--sage'
      : tone === 'teal' ? 'mac-titlebar mac-titlebar--teal'
      : 'mac-titlebar';
  return (
    <div className={`mac-window ${className}`}>
      <div className={bar}>
        <span className="mac-closebox" aria-hidden />
        <span className="mac-title">{title}</span>
        <div className="flex-1" />
        {right}
      </div>
      {children}
    </div>
  );
}

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
  const counts = new Map<string, number>();
  for (const f of files) {
    const segs = f.path.split('/');
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
        { icon: FileTextIcon, label: 'Notes in vault', value: pulse.total.toLocaleString() },
        { icon: FlameIcon, label: 'Touched / 7d', value: String(pulse.touchedWeek) },
        { icon: DatabaseIcon, label: 'Hottest area', value: pulse.hottestArea ?? '—' },
        { icon: Share2Icon, label: 'Wikilinks', value: pulse.links.toLocaleString() },
      ]
    : [];

  return (
    <MacWindow
      tone="teal"
      title="Vault.pulse"
      className="mb-6"
      right={
        <Link to="/rockwell" className="mac-title !bg-[#cbdcbf] hover:!bg-white">
          Open vault ▸
        </Link>
      }
    >
      <div className="p-4">
        <div className="mac-inset px-4 py-3">
          {pulse ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {items.map((it) => (
                <div key={it.label} className="flex items-center gap-2.5">
                  <div className="bg-[#008080] border-2 border-[#1a1a1a] rounded p-1.5 shrink-0">
                    <it.icon size={16} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-crt text-2xl leading-none text-[#243975]">{it.value}</div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 truncate">{it.label}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span className="font-crt text-lg text-gray-500">Reading the vault…</span>
          )}
        </div>
      </div>
    </MacWindow>
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
      className={`mac-card border-l-[6px] ${PRIORITY_ACCENT[task.priority]} px-3 py-2.5 cursor-grab active:cursor-grabbing group`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={onCycleStatus}
          title={`${STATUS_LABEL[task.status]} — click to advance`}
          className={`mt-0.5 shrink-0 ${task.status === 'done' ? 'text-[#008080]' : task.status === 'doing' ? 'text-[#243975]' : 'text-gray-300 hover:text-gray-500'}`}
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
              <span className="text-[11px] text-gray-500">{PRIORITY_LABEL[task.priority]}</span>
            )}
            {task.notes && <StickyNoteIcon size={11} className="text-gray-400" />}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#243975] shrink-0"
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
  const field = 'mt-1 w-full rounded-md border-2 border-[#1a1a1a] px-2 py-1.5 text-sm text-gray-800 bg-white focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <MacWindow title="Edit Task" className="w-full max-w-md">
        <div className="p-5" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            className="w-full text-base font-medium text-gray-900 border-b-2 border-[#1a1a1a] pb-2 mb-4 focus:outline-none"
            placeholder="Task title"
          />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="text-xs text-gray-600">
              Bucket
              <select value={draft.bucketId} onChange={(e) => set('bucketId', e.target.value)} className={field}>
                {buckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Status
              <select value={draft.status} onChange={(e) => set('status', e.target.value as Status)} className={field}>
                {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Due date
              <input type="date" value={draft.due ?? ''} onChange={(e) => set('due', e.target.value || null)} className={field} />
            </label>
            <label className="text-xs text-gray-600">
              Priority
              <select value={draft.priority} onChange={(e) => set('priority', e.target.value as Priority)} className={field}>
                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-xs text-gray-600 block mb-4">
            Notes
            <textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
              className={`${field} resize-y`} placeholder="Details, links, context…" />
          </label>
          <div className="flex items-center justify-between">
            <button onClick={onDelete} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800">
              <Trash2Icon size={15} /> Delete
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="mac-btn text-sm">Cancel</button>
              <button
                onClick={() => draft.title.trim() && onSave({ ...draft, updatedAt: new Date().toISOString() })}
                className="mac-btn mac-btn--default text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </MacWindow>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goals — timeframed goals (Week / Quarter / Year) with progress bars
// ---------------------------------------------------------------------------

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

interface GoalCardProps {
  goal: Goal;
  onSetProgress: (pct: number) => void;
  onOpen: () => void;
  onEdit: () => void;
}

function GoalCard({ goal, onSetProgress, onOpen, onEdit }: GoalCardProps) {
  const done = goal.progress >= 100;
  const overdue = goal.target && !done && goal.target < todayStr();
  const hasNote = goal.notes.trim().length > 0;
  return (
    <div className="mac-card px-3 py-2.5">
      <div className="flex items-start gap-2">
        <button
          onClick={onOpen}
          title="Open goal"
          className="min-w-0 flex-1 text-left group/goal"
        >
          <p className={`text-sm leading-snug group-hover/goal:text-[#243975] ${done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {goal.title}
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            {goal.target && (
              <span className={`inline-flex items-center gap-1 text-[11px] ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                <FlagIcon size={11} /> {goal.target}
              </span>
            )}
            {hasNote && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                <StickyNoteIcon size={11} /> note
              </span>
            )}
          </div>
        </button>
        <button onClick={onEdit} title="Edit goal" className="text-gray-400 hover:text-[#243975] shrink-0">
          <PencilIcon size={14} />
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <button
          onClick={() => onSetProgress(clampPct(goal.progress - 10))}
          disabled={goal.progress <= 0}
          className="mac-btn !px-1.5 !py-1 disabled:opacity-30"
          title="−10%"
        >
          <MinusIcon size={12} />
        </button>
        <div className={`mac-progress flex-1 ${done ? 'mac-progress--done' : ''}`}>
          <span style={{ width: `${goal.progress}%` }} />
        </div>
        <button
          onClick={() => onSetProgress(clampPct(goal.progress + 10))}
          disabled={goal.progress >= 100}
          className="mac-btn !px-1.5 !py-1 disabled:opacity-30"
          title="+10%"
        >
          <PlusIcon size={12} />
        </button>
        <span className="font-crt text-lg leading-none text-[#243975] w-10 text-right tabular-nums">
          {goal.progress}%
        </span>
      </div>
    </div>
  );
}

interface GoalDetailProps {
  goal: Goal;
  onEdit: () => void;
  onSetProgress: (pct: number) => void;
  onClose: () => void;
}

function GoalDetail({ goal, onEdit, onSetProgress, onClose }: GoalDetailProps) {
  const done = goal.progress >= 100;
  const overdue = goal.target && !done && goal.target < todayStr();
  const hasNote = goal.notes.trim().length > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <MacWindow title={HORIZON_LABEL[goal.horizon]} tone="sage" className="w-full max-w-lg">
        <div className="p-5 max-h-[80vh] overflow-y-auto rw-scrollbar" onClick={(e) => e.stopPropagation()}>
          <h2 className={`text-xl font-pixel leading-tight ${done ? 'text-gray-400 line-through' : 'text-[#243975]'}`}>
            {goal.title}
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px]">
            <span className="mac-title !bg-[#cbdcbf]">{HORIZON_LABEL[goal.horizon]}</span>
            {goal.target && (
              <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                <FlagIcon size={12} /> Target {goal.target}
              </span>
            )}
          </div>

          {/* Progress */}
          <div className="mt-4 flex items-center gap-2">
            <button onClick={() => onSetProgress(clampPct(goal.progress - 10))} disabled={goal.progress <= 0}
              className="mac-btn !px-1.5 !py-1 disabled:opacity-30" title="−10%"><MinusIcon size={12} /></button>
            <div className={`mac-progress flex-1 ${done ? 'mac-progress--done' : ''}`}>
              <span style={{ width: `${goal.progress}%` }} />
            </div>
            <button onClick={() => onSetProgress(clampPct(goal.progress + 10))} disabled={goal.progress >= 100}
              className="mac-btn !px-1.5 !py-1 disabled:opacity-30" title="+10%"><PlusIcon size={12} /></button>
            <span className="font-crt text-lg leading-none text-[#243975] w-10 text-right tabular-nums">{goal.progress}%</span>
          </div>

          {/* Note body */}
          <div className="mac-inset mt-4 p-4">
            {hasNote ? (
              <article className="prose prose-sm max-w-none prose-headings:text-[#243975] prose-a:text-[#008080] prose-strong:text-gray-800">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{goal.notes}</ReactMarkdown>
              </article>
            ) : (
              <p className="text-sm text-gray-400 italic">No note yet. Click Edit to write one.</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 mt-5">
            <button onClick={onClose} className="mac-btn text-sm">Close</button>
            <button onClick={onEdit} className="mac-btn mac-btn--default text-sm">
              <PencilIcon size={14} /> Edit
            </button>
          </div>
        </div>
      </MacWindow>
    </div>
  );
}

interface GoalEditorProps {
  goal: Goal;
  onSave: (g: Goal) => void;
  onDelete: () => void;
  onClose: () => void;
}

function GoalEditor({ goal, onSave, onDelete, onClose }: GoalEditorProps) {
  const [draft, setDraft] = useState<Goal>(goal);
  const set = <K extends keyof Goal>(k: K, v: Goal[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const field = 'mt-1 w-full rounded-md border-2 border-[#1a1a1a] px-2 py-1.5 text-sm text-gray-800 bg-white focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <MacWindow title="Edit Goal" tone="sage" className="w-full max-w-md">
        <div className="p-5" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            className="w-full text-base font-medium text-gray-900 border-b-2 border-[#1a1a1a] pb-2 mb-4 focus:outline-none"
            placeholder="Goal"
          />
          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className="text-xs text-gray-600">
              Horizon
              <select value={draft.horizon} onChange={(e) => set('horizon', e.target.value as Horizon)} className={field}>
                {HORIZONS.map((h) => <option key={h} value={h}>{HORIZON_LABEL[h]}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600">
              Target date
              <input type="date" value={draft.target ?? ''} onChange={(e) => set('target', e.target.value || null)} className={field} />
            </label>
          </div>
          <label className="text-xs text-gray-600 block mb-4">
            Progress — {draft.progress}%
            <input
              type="range" min={0} max={100} step={5} value={draft.progress}
              onChange={(e) => set('progress', clampPct(Number(e.target.value)))}
              className="mt-2 w-full accent-[#008080]"
            />
          </label>
          <label className="text-xs text-gray-600 block mb-4">
            Note <span className="text-gray-400">(markdown — the full write-up for this goal)</span>
            <textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} rows={8}
              className={`${field} resize-y font-mono`}
              placeholder={'# Goal write-up\n\nWhy it matters, the plan, links, milestones…'} />
          </label>
          <div className="flex items-center justify-between">
            <button onClick={onDelete} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800">
              <Trash2Icon size={15} /> Delete
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="mac-btn text-sm">Cancel</button>
              <button
                onClick={() => draft.title.trim() && onSave({ ...draft, updatedAt: new Date().toISOString() })}
                className="mac-btn mac-btn--default text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </MacWindow>
    </div>
  );
}

interface GoalsPanelProps {
  goals: Goal[];
  onAdd: (horizon: Horizon, title: string) => void;
  onSetProgress: (id: string, pct: number) => void;
  onOpen: (g: Goal) => void;
  onEdit: (g: Goal) => void;
}

function GoalsColumn({ horizon, goals, onAdd, onSetProgress, onOpen, onEdit }: {
  horizon: Horizon;
  goals: Goal[];
  onAdd: (title: string) => void;
  onSetProgress: (id: string, pct: number) => void;
  onOpen: (g: Goal) => void;
  onEdit: (g: Goal) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const avg = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0;

  function submit() {
    const t = title.trim();
    if (t) onAdd(t);
    setTitle('');
    setAdding(false);
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="font-pixel text-[11px] text-[#243975]">{HORIZON_LABEL[horizon]}</span>
        <span className="font-crt text-base text-gray-500">{goals.length ? `${avg}% avg` : '—'}</span>
      </div>
      <div className="mac-inset p-2.5 space-y-2 min-h-[80px]">
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} onSetProgress={(p) => onSetProgress(g.id, p)} onOpen={() => onOpen(g)} onEdit={() => onEdit(g)} />
        ))}
        {goals.length === 0 && <p className="text-xs text-gray-400 text-center py-3">No goals yet.</p>}
        {adding ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setTitle(''); setAdding(false); } }}
            placeholder="Goal, Enter to add"
            className="w-full rounded-md border-2 border-[#008080] px-2.5 py-1.5 text-sm focus:outline-none"
          />
        ) : (
          <button onClick={() => setAdding(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-gray-300 py-1.5 text-xs text-gray-500 hover:border-[#008080] hover:text-[#008080]">
            <PlusIcon size={13} /> Add goal
          </button>
        )}
      </div>
    </div>
  );
}

function GoalsPanel({ goals, onAdd, onSetProgress, onOpen, onEdit }: GoalsPanelProps) {
  return (
    <MacWindow
      tone="sage"
      title={<span className="inline-flex items-center gap-1.5"><TargetIcon size={12} /> Goals</span>}
      className="mb-6"
    >
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {HORIZONS.map((h) => (
          <GoalsColumn
            key={h}
            horizon={h}
            goals={goals.filter((g) => g.horizon === h)}
            onAdd={(title) => onAdd(h, title)}
            onSetProgress={onSetProgress}
            onOpen={onOpen}
            onEdit={onEdit}
          />
        ))}
      </div>
    </MacWindow>
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
      className={`mac-window flex flex-col w-72 shrink-0 max-h-[70vh] ${dragOver ? 'ring-2 ring-[#008080] ring-offset-2' : ''}`}
    >
      {/* Pinstripe title bar */}
      <div className="mac-titlebar">
        <span className="mac-closebox" aria-hidden />
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { setRenaming(false); if (name.trim() && name !== bucket.name) props.onRename(name.trim()); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setName(bucket.name); setRenaming(false); } }}
            className="mac-title flex-1 !font-sans focus:outline-none"
          />
        ) : (
          <button onClick={() => setRenaming(true)} title="Click to rename" className="mac-title max-w-[9rem] overflow-hidden text-ellipsis">
            {bucket.name}
          </button>
        )}
        <span className="mac-title !bg-[#cbdcbf] !px-1.5 tabular-nums">{openCount}</span>
        <div className="flex-1" />
        <button onClick={() => props.onMove(-1)} disabled={isFirst}
          className="text-white/80 hover:text-white disabled:opacity-30"><ChevronLeftIcon size={14} /></button>
        <button onClick={() => props.onMove(1)} disabled={isLast}
          className="text-white/80 hover:text-white disabled:opacity-30"><ChevronRightIcon size={14} /></button>
        <button onClick={props.onDelete} title="Delete bucket"
          className="text-white/80 hover:text-red-300"><Trash2Icon size={14} /></button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 rw-scrollbar">
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
            className="w-full rounded-md border-2 border-[#008080] px-2.5 py-1.5 text-sm focus:outline-none"
          />
        ) : (
          <button onClick={() => setAdding(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-gray-300 py-1.5 text-xs text-gray-500 hover:border-[#008080] hover:text-[#008080]">
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
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [viewingGoal, setViewingGoal] = useState<Goal | null>(null);
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

  // ── Task mutations ──────────────────────────────────────────────────────────

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

  // ── Goal mutations ──────────────────────────────────────────────────────────

  function addGoal(horizon: Horizon, title: string) {
    update((b) => ({ ...b, goals: [...b.goals, newGoal(horizon, title)] }));
  }

  function setGoalProgress(id: string, pct: number) {
    update((b) => ({
      ...b,
      goals: b.goals.map((g) => (g.id === id ? { ...g, progress: pct, updatedAt: new Date().toISOString() } : g)),
    }));
  }

  function saveGoal(g: Goal) {
    update((b) => ({ ...b, goals: b.goals.map((x) => (x.id === g.id ? g : x)) }));
    setEditingGoal(null);
  }

  function deleteGoal(id: string) {
    update((b) => ({ ...b, goals: b.goals.filter((x) => x.id !== id) }));
    setEditingGoal(null);
  }

  // ── Bucket mutations ────────────────────────────────────────────────────────

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
    return (
      <div className="mac-desktop w-full min-h-[70vh] flex items-center justify-center">
        <span className="font-crt text-2xl text-[#243975]">Loading your console…</span>
      </div>
    );
  }

  return (
    <div className="mac-desktop w-full min-h-[70vh] px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header window */}
        <MacWindow
          title="Rockwell Console"
          className="mb-6"
          right={
            <>
              <span className={`mac-title !bg-transparent !border-0 !text-white/90 ${saveState === 'error' ? '!text-red-200' : ''}`}>
                {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved'}
              </span>
            </>
          }
        >
          <div className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-[#243975] border-2 border-[#1a1a1a] p-2.5 rounded-md shadow-[2px_2px_0_0_rgba(26,26,26,0.85)]">
                <LayoutDashboardIcon size={24} className="text-white" />
              </div>
              <div>
                <h1 className="font-pixel text-2xl text-[#243975] leading-tight">Rockwell Console</h1>
                <p className="font-crt text-lg text-gray-600 leading-tight">
                  {user?.email} · {openTotal} open task{openTotal === 1 ? '' : 's'}
                  {dueSoon > 0 && <span className="text-amber-700"> · {dueSoon} due now</span>}
                </p>
              </div>
            </div>
            <button onClick={() => setHideDone((h) => !h)} className="mac-btn text-xs">
              {hideDone ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
              {hideDone ? 'Show done' : 'Hide done'}
            </button>
          </div>
        </MacWindow>

        {/* Vault pulse — the brains behind Rockota */}
        {token && <VaultPulseStrip token={token} />}

        {/* Goals */}
        <GoalsPanel
          goals={board.goals}
          onAdd={addGoal}
          onSetProgress={setGoalProgress}
          onOpen={setViewingGoal}
          onEdit={setEditingGoal}
        />

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
                className="w-full rounded-lg border-2 border-[#008080] px-3 py-2.5 text-sm focus:outline-none"
              />
            ) : (
              <button onClick={() => setAddingBucket(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-400 py-2.5 text-sm text-gray-600 hover:border-[#008080] hover:text-[#008080] bg-white/50">
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

      {viewingGoal && (() => {
        const live = board.goals.find((g) => g.id === viewingGoal.id);
        if (!live) return null;
        return (
          <GoalDetail
            goal={live}
            onSetProgress={(pct) => setGoalProgress(live.id, pct)}
            onEdit={() => { setViewingGoal(null); setEditingGoal(live); }}
            onClose={() => setViewingGoal(null)}
          />
        );
      })()}

      {editingGoal && (
        <GoalEditor
          goal={editingGoal}
          onSave={saveGoal}
          onDelete={() => deleteGoal(editingGoal.id)}
          onClose={() => setEditingGoal(null)}
        />
      )}
    </div>
  );
};

export default ConsolePage;
