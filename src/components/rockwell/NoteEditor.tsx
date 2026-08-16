import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Save, FileText, Eye, Edit3 } from 'lucide-react';
import { vaultRead, vaultWrite } from '../../lib/vault-api';

// @uiw/react-md-editor uses the window object — load lazily.
const MDEditor = lazy(() => import('@uiw/react-md-editor').then((m) => ({ default: m.default })));

// ── Wikilink support ────────────────────────────────────────────────────────
// Synchronous remark plugin: transforms [[target]] → [target](wiki:target).
// Must be sync — remark's runSync does not support async plugins.
export const WIKI_URL_PREFIX = 'wiki:';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function remarkWikiLinks(): (tree: any) => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    // Walk nodes manually — avoids needing unist-util-visit as an async import.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function walk(node: any, parent: any, index: number) {
      if (node.type === 'text' && parent && typeof node.value === 'string') {
        const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
        let match: RegExpExecArray | null;
        let lastIndex = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const children: any[] = [];
        while ((match = re.exec(node.value)) !== null) {
          if (match.index > lastIndex) children.push({ type: 'text', value: node.value.slice(lastIndex, match.index) });
          const target = match[1].trim();
          const label = (match[2] || target).trim();
          children.push({ type: 'link', url: `${WIKI_URL_PREFIX}${target}`, children: [{ type: 'text', value: label }] });
          lastIndex = re.lastIndex;
        }
        if (children.length > 0) {
          if (lastIndex < node.value.length) children.push({ type: 'text', value: node.value.slice(lastIndex) });
          parent.children.splice(index, 1, ...children);
          return; // don't recurse into replaced nodes
        }
      }
      if (node.children) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          walk(node.children[i], node, i);
        }
      }
    }
    walk(tree, null, 0);
  };
}

// ── PlotBlock — renders ```plot fenced blocks as an interactive chart ─────────
// YAML spec → function-plot. Supports:
//   • functions: curves (expr), with optional domain `range`, area shading
//     `closed`/`area: [a,b]` (integrals), a static `tangent: {at, deriv}`
//     (derivatives), and `secant: {at, to, track}` (limit of secants → tangent).
//   • points: standalone points ({at:[x,y]} or {coords:[[x,y],…], join:true}).
//   • lines: straight segments through two points ({through:[[x,y],[x,y]]}) —
//     secants/chords with no algebra needed.
//   • markers / asymptotes: x or y reference lines ({x|y, label}).
// Backwards compatible with the original {functions:[{expr,color}], xRange,
// yRange, xLabel, yLabel} spec. Skips rendering if the lib isn't loaded.
function PlotBlock({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([import('function-plot'), import('js-yaml')])
      .then(([{ default: functionPlot }, { load }]) => {
        if (cancelled || !ref.current) return;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cfg: any = load(source) || {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data: any[] = [];

          // Curves — with optional domain restriction, area shading, tangent, secant.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const f of (cfg.functions || []) as any[]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d: any = { fn: f.expr, graphType: f.type === 'scatter' ? 'scatter' : 'polyline' };
            if (f.color) d.color = f.color;
            let range = f.range;
            let closed = f.closed;
            if (Array.isArray(f.area)) { range = f.area; closed = true; }
            if (Array.isArray(range)) d.range = range;
            if (closed) d.closed = true;
            if (f.tangent && f.tangent.deriv != null && f.tangent.at != null) {
              d.derivative = { fn: String(f.tangent.deriv), x0: f.tangent.at, updateOnMouseMove: !!f.tangent.track };
            }
            if (f.secant && f.secant.at != null) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const sec: any = { x0: f.secant.at, updateOnMouseMove: !!f.secant.track };
              if (f.secant.to != null) sec.x1 = f.secant.to;
              d.secants = [sec];
            }
            data.push(d);
          }

          // Standalone points (scatter by default, or joined polyline).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const p of (cfg.points || []) as any[]) {
            const coords = p.coords || (p.at ? [p.at] : []);
            if (!coords.length) continue;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d: any = { points: coords, fnType: 'points', graphType: p.join ? 'polyline' : 'scatter' };
            if (p.color) d.color = p.color;
            data.push(d);
          }

          // Straight lines through two points (secants / chords).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const ln of (cfg.lines || []) as any[]) {
            if (!Array.isArray(ln.through) || ln.through.length < 2) continue;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d: any = { points: ln.through, fnType: 'points', graphType: 'polyline' };
            if (ln.color) d.color = ln.color;
            data.push(d);
          }

          // Reference markers / asymptotes → annotations (x or y line + label).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const annotations: any[] = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const m of ((cfg.markers || cfg.asymptotes) || []) as any[]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const a: any = {};
            if (m.x != null) a.x = m.x;
            if (m.y != null) a.y = m.y;
            if (m.label) a.text = m.label;
            if (a.x != null || a.y != null) annotations.push(a);
          }

          ref.current.innerHTML = '';
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const opts: any = {
            target: ref.current,
            width: cfg.width || 480,
            height: cfg.height || 280,
            grid: cfg.grid !== false,
            xAxis: { domain: cfg.xRange, label: cfg.xLabel ? `${cfg.xLabel}${cfg.xUnit ? ` (${cfg.xUnit})` : ''}` : undefined },
            yAxis: { domain: cfg.yRange, label: cfg.yLabel ? `${cfg.yLabel}${cfg.yUnit ? ` (${cfg.yUnit})` : ''}` : undefined },
            data,
          };
          if (annotations.length) opts.annotations = annotations;
          functionPlot(opts);
        } catch (e) {
          if (ref.current) ref.current.innerHTML = `<pre style="color:red;font-size:11px">Plot error: ${e}</pre>`;
        }
      })
      .catch(() => {
        if (ref.current) ref.current.innerHTML = '<pre style="color:#888;font-size:11px">Plot library not installed yet.</pre>';
      });
    return () => { cancelled = true; };
  }, [source]);
  return <div ref={ref} className="my-2" />;
}

function extractText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: React.ReactNode } }).props;
    return extractText(props?.children);
  }
  return '';
}

// ── NoteEditor ──────────────────────────────────────────────────────────────

interface NoteEditorProps {
  path: string | null;
  onSaved?: () => void;
  onNavigateWiki?: (target: string) => void;
  token: string | null;
  /** Lock to preview-only mode (no edit/split toggles, no save button) */
  forcePreview?: boolean;
}

export default function NoteEditor({ path, onSaved, onNavigateWiki, token, forcePreview }: NoteEditorProps) {
  const [content, setContent] = useState('');
  const [origContent, setOrigContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<'live' | 'edit' | 'preview'>('preview');
  const activePreview = forcePreview ? 'preview' : preview;
  const dirty = content !== origContent;
  const lastLoadedPath = useRef<string | null>(null);

  const previewOptions = useMemo(() => ({
    remarkPlugins: [remarkWikiLinks],
    components: {
      a: ({ href, children, ...rest }: { href?: string; children?: React.ReactNode }) => {
        if (href?.startsWith(WIKI_URL_PREFIX)) {
          const target = href.slice(WIKI_URL_PREFIX.length);
          return (
            <a href="#" onClick={(e) => { e.preventDefault(); onNavigateWiki?.(target); }}
              className="text-rw-gold underline decoration-rw-gold/50 hover:decoration-rw-gold cursor-pointer" {...rest}>
              {children}
            </a>
          );
        }
        return <a href={href} {...rest} className="text-rw-gold/90 underline decoration-rw-gold/30 hover:decoration-rw-gold">{children}</a>;
      },
      pre: ({ children, ...rest }: { children?: React.ReactNode }) => {
        const child = Array.isArray(children) ? children[0] : children;
        const className = (child as { props?: { className?: string } })?.props?.className || '';
        if (className.includes('language-plot')) return <>{children}</>;
        return <pre {...rest}>{children}</pre>;
      },
      code: ({ inline, className, children, ...rest }: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
        if (!inline && /language-plot\b/.test(className || '')) {
          const source = extractText(children).replace(/\n$/, '');
          return <PlotBlock source={source} />;
        }
        return <code className={className} {...rest}>{children}</code>;
      },
    },
  }), [onNavigateWiki]);

  useEffect(() => {
    if (!path) { setContent(''); setOrigContent(''); setError(null); lastLoadedPath.current = null; return; }
    if (lastLoadedPath.current === path && !error) return;
    setPreview('preview'); // reset to preview mode on each new note
    let abort = false;
    setLoading(true);
    setError(null);
    vaultRead(path, token)
      .then((j) => {
        if (abort) return;
        if (j.error) { setContent(''); setOrigContent(''); }
        else { setContent(j.content || ''); setOrigContent(j.content || ''); }
        lastLoadedPath.current = path;
      })
      .catch((e) => { if (!abort) setError(String(e)); })
      .finally(() => { if (!abort) setLoading(false); });
    return () => { abort = true; };
  }, [path, error, token]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const save = async () => {
    if (!path || saving || !token) return;
    setSaving(true);
    setError(null);
    try {
      await vaultWrite(path, content, token);
      setOrigContent(content);
      onSaved?.();
    } catch (e) {
      setError((e as Error).message || 'save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!path) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-rw-gray/40">
        <FileText size={36} className="opacity-40" />
        <span className="text-xs tracking-widest uppercase">No note selected</span>
        <span className="text-[11px]">
          {forcePreview ? 'Click a node in the graph to open a note.' : 'Select a note from the vault — or create one.'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-rw-gold/10 bg-rw-surface/50">
        <FileText size={13} className="text-rw-gold/60" />
        <span className="text-xs text-rw-foreground/90 truncate flex-1">{path}</span>
        {!forcePreview && dirty && <span className="text-[10px] text-rw-gold/60 italic">unsaved</span>}
        {!forcePreview && (
          <div className="flex items-center gap-1 mr-2">
            <button onClick={() => setPreview('edit')} className={`p-1 rounded text-xs transition-colors ${preview === 'edit' ? 'bg-rw-gold/15 text-rw-gold' : 'text-rw-gray hover:text-rw-gold'}`} title="Edit only"><Edit3 size={12} /></button>
            <button onClick={() => setPreview('live')} className={`p-1 rounded text-xs transition-colors ${preview === 'live' ? 'bg-rw-gold/15 text-rw-gold' : 'text-rw-gray hover:text-rw-gold'}`} title="Split"><span className="text-[10px] font-mono">⇆</span></button>
            <button onClick={() => setPreview('preview')} className={`p-1 rounded text-xs transition-colors ${preview === 'preview' ? 'bg-rw-gold/15 text-rw-gold' : 'text-rw-gray hover:text-rw-gold'}`} title="Preview only"><Eye size={12} /></button>
          </div>
        )}
        {token && !forcePreview && (
          <button onClick={save} disabled={!dirty || saving}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-rw-gold/15 text-rw-gold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rw-gold/25 transition-colors">
            <Save size={12} />{saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      {error && <div className="px-3 py-2 text-xs text-red-400 border-b border-red-400/20">{error}</div>}
      <div className="flex-1 min-h-0 overflow-hidden" data-color-mode="dark">
        {loading ? (
          <div className="flex-1 h-full flex items-center justify-center text-xs text-rw-gray/50">Loading…</div>
        ) : (
          <Suspense fallback={<div className="flex-1 h-full flex items-center justify-center text-xs text-rw-gray/50">Loading editor…</div>}>
            <MDEditor
              value={content}
              onChange={(v) => { if (!forcePreview) setContent(v ?? ''); }}
              preview={activePreview}
              height="100%"
              visibleDragbar={false}
              previewOptions={previewOptions as Parameters<typeof MDEditor>[0]['previewOptions']}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
