import {
  lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import * as THREE from 'three';
import { Loader2, Maximize2, Minimize2, NotebookText } from 'lucide-react';
import { vaultGraph } from '../../lib/vault-api';

// react-force-graph-3d uses three.js + WebGL — load lazily.
const ForceGraph3D = lazy(() => import('react-force-graph-3d'));

// ── Types ──────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  title: string;
  scope: 'user' | 'domain';
  topFolder: string;
  folderPath: string;
  degree: number;
  ghost?: boolean;
}

interface SimNode extends GraphNode {
  x?: number; y?: number; z?: number;
  vx?: number; vy?: number; vz?: number;
}

interface SimLink { source: string | SimNode; target: string | SimNode; }

interface NodeMaterials {
  body: THREE.MeshPhongMaterial;
  halo: THREE.MeshBasicMaterial;
  ring: THREE.MeshBasicMaterial | null;
  base: THREE.Color;
  dark: THREE.Color;
}

interface FolderTreeNode { name: string; fullPath: string; count: number; children: Map<string, FolderTreeNode>; }
interface FolderLegendEntry { path: string; label: string; depth: number; count: number; hasChildren: boolean; }

export interface VaultGraphProps {
  selectedPath: string | null;
  onSelect: (path: string) => void;
  refreshKey: number;
  token?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function hashHue(key: string): number {
  if (!key) return 210;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

function paletteFor(node: GraphNode) {
  const hue = hashHue(node.topFolder || node.scope);
  const baseL = node.scope === 'user' ? 70 : 58;
  const sat = node.topFolder ? 78 : 28;
  return {
    base: `hsl(${hue}, ${sat}%, ${baseL}%)`,
    dark: `hsl(${hue}, ${sat}%, ${Math.max(baseL - 36, 6)}%)`,
  };
}

function folderChipColor(folderPath: string): string {
  const top = folderPath.split('/').filter(Boolean)[0] ?? folderPath;
  return `hsl(${hashHue(top)}, 78%, 62%)`;
}

function radiusFor(node: GraphNode): number { return 3 + Math.sqrt(node.degree) * 1.8; }

function nodeInFocus(node: GraphNode, focusedPath: string): boolean {
  const path = node.folderPath || node.topFolder;
  if (!path) return false;
  return path === focusedPath || path.startsWith(focusedPath + '/');
}

const SELECTED_COLOR = new THREE.Color('#f59e0b');
const SPHERE_GEOMETRY = new THREE.SphereGeometry(1, 32, 32);
const HALO_GEOMETRY = new THREE.SphereGeometry(1, 16, 16);

// ── Component ──────────────────────────────────────────────────────────────

export default function VaultGraph({ selectedPath, onSelect, refreshKey, token }: VaultGraphProps) {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<{ node: SimNode; x: number; y: number } | null>(null);
  const [focusedFolderPath, setFocusedFolderPath] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [fullscreen, setFullscreen] = useState(false);
  const [data, setData] = useState<{ nodes: SimNode[]; links: SimLink[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const nodeMaterialsRef = useRef<Map<string, NodeMaterials>>(new Map());

  useEffect(() => {
    let abort = false;
    setLoading(true);
    setErrorMsg(null);
    vaultGraph(token)
      .then((j) => {
        if (abort) return;
        const nodes = (j.nodes as GraphNode[]).map((n) => ({ ...n })) as SimNode[];
        const links = (j.edges as { source: string; target: string }[]).map(
          (e) => ({ source: e.source, target: e.target })
        ) as SimLink[];
        setData({ nodes, links });
      })
      .catch((e) => { if (!abort) setErrorMsg(String(e)); })
      .finally(() => { if (!abort) setLoading(false); });
    return () => { abort = true; };
  }, [refreshKey, token]);

  useEffect(() => {
    if (!containerEl) return;
    const ro = new ResizeObserver(() => {
      const rect = containerEl.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    });
    ro.observe(containerEl);
    const rect = containerEl.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
  }, [containerEl, fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const graphData = useMemo(() => data ?? { nodes: [] as SimNode[], links: [] as SimLink[] }, [data]);

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    graphData.nodes.forEach((n) => map.set(n.id, new Set()));
    graphData.links.forEach((l) => {
      const src = typeof l.source === 'string' ? l.source : l.source.id;
      const tgt = typeof l.target === 'string' ? l.target : l.target.id;
      map.get(src)?.add(tgt);
      map.get(tgt)?.add(src);
    });
    return map;
  }, [graphData]);

  const nodesById = useMemo(() => {
    const m = new Map<string, SimNode>();
    graphData.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [graphData]);

  const folderTreeAndAllPaths = useMemo(() => {
    const root: FolderTreeNode = { name: '', fullPath: '', count: 0, children: new Map() };
    const allPaths = new Set<string>();
    for (const n of graphData.nodes) {
      if (!n.topFolder) continue;
      const fullPath = n.folderPath || n.topFolder;
      const segments = fullPath.split('/').filter(Boolean);
      let current = root;
      let cumulative = '';
      for (const seg of segments) {
        cumulative = cumulative ? `${cumulative}/${seg}` : seg;
        allPaths.add(cumulative);
        if (!current.children.has(seg)) {
          current.children.set(seg, { name: seg, fullPath: cumulative, count: 0, children: new Map() });
        }
        current = current.children.get(seg)!;
        current.count += 1;
      }
    }
    return { root, allPaths };
  }, [graphData]);

  const folderLegendEntries = useMemo((): FolderLegendEntry[] => {
    const entries: FolderLegendEntry[] = [];
    const walk = (node: FolderTreeNode, depth: number) => {
      const sorted = Array.from(node.children.values()).sort((a, b) => b.count - a.count);
      for (const child of sorted) {
        entries.push({ path: child.fullPath, label: child.name, depth, count: child.count, hasChildren: child.children.size > 0 });
        if (expandedFolders.has(child.fullPath)) walk(child, depth + 1);
      }
    };
    walk(folderTreeAndAllPaths.root, 0);
    return entries;
  }, [folderTreeAndAllPaths, expandedFolders]);

  useEffect(() => {
    if (!graphData.nodes.length || !graphRef.current) return;
    const timer = setTimeout(() => graphRef.current?.zoomToFit(800, 80), 1400);
    return () => clearTimeout(timer);
  }, [graphData]);

  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || size.width === 0 || size.height === 0) return;
    const renderer = fg.renderer();
    renderer.setClearColor(0x000000, 0);
    renderer.setClearAlpha(0);
    const scene = fg.scene();
    const fill = new THREE.PointLight(0x8b5cf6, 0.4, 0, 2);
    fill.position.set(-300, 200, -400);
    scene.add(fill);
    const rim = new THREE.PointLight(0x0ea5e9, 0.35, 0, 2);
    rim.position.set(400, -200, 300);
    scene.add(rim);
    return () => { scene.remove(fill); scene.remove(rim); fill.dispose(); rim.dispose(); };
  }, [size.width, size.height]);

  useEffect(() => {
    const fg = graphRef.current;
    if (!fg || !graphData.nodes.length) return;
    const clusterForce = (alpha: number) => {
      const centroids = new Map<string, { x: number; y: number; z: number; count: number }>();
      for (const n of graphData.nodes) {
        const key = n.topFolder || `_scope:${n.scope}`;
        let c = centroids.get(key);
        if (!c) { c = { x: 0, y: 0, z: 0, count: 0 }; centroids.set(key, c); }
        c.x += n.x || 0; c.y += n.y || 0; c.z += n.z || 0; c.count++;
      }
      centroids.forEach((c) => { if (c.count) { c.x /= c.count; c.y /= c.count; c.z /= c.count; } });
      const strength = 0.22 * alpha;
      for (const n of graphData.nodes) {
        const key = n.topFolder || `_scope:${n.scope}`;
        const c = centroids.get(key);
        if (!c || n.x == null) continue;
        n.vx = (n.vx || 0) + (c.x - n.x) * strength;
        n.vy = (n.vy || 0) + (c.y - (n.y || 0)) * strength;
        n.vz = (n.vz || 0) + (c.z - (n.z || 0)) * strength;
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fg.d3Force('cluster', clusterForce as any);
    fg.d3ReheatSimulation();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { graphRef.current?.d3Force('cluster', null as any); };
  }, [graphData]);

  useEffect(() => {
    if (focusedFolderPath && !folderTreeAndAllPaths.allPaths.has(focusedFolderPath)) {
      setFocusedFolderPath(null);
    }
  }, [focusedFolderPath, folderTreeAndAllPaths]);

  useEffect(() => {
    const hoveredId = hover?.node.id ?? null;
    const neighbors = hoveredId ? adjacency.get(hoveredId) : null;
    for (const node of graphData.nodes) {
      const mats = nodeMaterialsRef.current.get(node.id);
      if (!mats) continue;
      const id = node.id;
      const isHovered = id === hoveredId;
      const isNeighbor = !!neighbors?.has(id);
      const passesFocus = !focusedFolderPath || nodeInFocus(node, focusedFolderPath);
      const passesHover = !hoveredId || isHovered || isNeighbor;
      const dim = !passesFocus || !passesHover;
      mats.body.transparent = true;
      mats.body.opacity = dim ? 0.05 : 1;
      if (dim) {
        mats.body.emissive.copy(mats.dark);
        mats.body.emissiveIntensity = 0.02;
        mats.halo.color.copy(mats.base);
        mats.halo.opacity = 0.005;
      } else if (id === selectedPath || isHovered) {
        mats.body.emissive.copy(SELECTED_COLOR);
        mats.body.emissiveIntensity = isHovered ? 0.95 : 0.75;
        mats.halo.color.copy(SELECTED_COLOR);
        mats.halo.opacity = 0.3;
      } else {
        mats.body.emissive.copy(mats.dark);
        mats.body.emissiveIntensity = 0.35;
        mats.halo.color.copy(mats.base);
        mats.halo.opacity = 0.1;
      }
      if (mats.ring) mats.ring.opacity = dim ? 0.02 : 0.28;
    }
  }, [hover, selectedPath, adjacency, focusedFolderPath, graphData]);

  const handleNodeClick = useCallback((node: SimNode) => {
    if (!node.id || node.id.startsWith('ghost:')) return;
    onSelect(node.id);
  }, [onSelect]);

  const handleNodeHover = useCallback((node: SimNode | null) => {
    if (!node || !Number.isFinite(node.x) || !graphRef.current) { setHover(null); return; }
    const coords = graphRef.current.graph2ScreenCoords(node.x!, node.y!, node.z!);
    setHover({ node, x: coords.x, y: coords.y });
  }, []);

  const nodeThreeObject = useCallback((node: SimNode) => {
    const r = radiusFor(node);
    const palette = paletteFor(node);
    const baseColor = new THREE.Color(palette.base);
    const darkColor = new THREE.Color(palette.dark);
    const dimByFocus = !!focusedFolderPath && !nodeInFocus(node, focusedFolderPath);

    const material = new THREE.MeshPhongMaterial({
      color: baseColor, emissive: darkColor.clone(), emissiveIntensity: dimByFocus ? 0.02 : 0.35,
      shininess: 95, specular: new THREE.Color(0xffffff), transparent: true, opacity: dimByFocus ? 0.05 : 1,
    });
    const sphere = new THREE.Mesh(SPHERE_GEOMETRY, material);
    sphere.scale.setScalar(r);

    const haloMat = new THREE.MeshBasicMaterial({
      color: baseColor.clone(), transparent: true, opacity: dimByFocus ? 0.005 : 0.1,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const halo = new THREE.Mesh(HALO_GEOMETRY, haloMat);
    halo.scale.setScalar(r * 1.55);

    const group = new THREE.Group();
    group.add(halo);
    group.add(sphere);

    let ringMat: THREE.MeshBasicMaterial | null = null;
    if (node.scope === 'user') {
      ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: dimByFocus ? 0.02 : 0.28, wireframe: true });
      const ring = new THREE.Mesh(SPHERE_GEOMETRY, ringMat);
      ring.scale.setScalar(r * 1.04);
      group.add(ring);
    }

    const prev = nodeMaterialsRef.current.get(node.id);
    if (prev) { prev.body.dispose(); prev.halo.dispose(); prev.ring?.dispose(); }
    nodeMaterialsRef.current.set(node.id, { body: material, halo: haloMat, ring: ringMat, base: baseColor, dark: darkColor });
    return group;
  }, [focusedFolderPath]);

  const linkTouchesFocus = useCallback((link: SimLink): boolean => {
    if (!focusedFolderPath) return true;
    const src = typeof link.source === 'string' ? link.source : link.source.id;
    const tgt = typeof link.target === 'string' ? link.target : link.target.id;
    const srcNode = nodesById.get(src);
    const tgtNode = nodesById.get(tgt);
    return (srcNode ? nodeInFocus(srcNode, focusedFolderPath) : false) || (tgtNode ? nodeInFocus(tgtNode, focusedFolderPath) : false);
  }, [focusedFolderPath, nodesById]);

  const linkIsDim = useCallback((link: SimLink): boolean => {
    const src = typeof link.source === 'string' ? link.source : link.source.id;
    const tgt = typeof link.target === 'string' ? link.target : link.target.id;
    const hoveredId = hover?.node.id ?? null;
    return (!hoveredId || (src !== hoveredId && tgt !== hoveredId)) && (!!focusedFolderPath && !linkTouchesFocus(link))
      ? true
      : (!!hoveredId && src !== hoveredId && tgt !== hoveredId) || (!!focusedFolderPath && !linkTouchesFocus(link));
  }, [hover, focusedFolderPath, linkTouchesFocus]);

  const linkColor = useCallback((link: SimLink) => {
    if (linkIsDim(link)) return 'rgba(186,200,220,0.06)';
    const src = typeof link.source === 'string' ? link.source : link.source.id;
    const tgt = typeof link.target === 'string' ? link.target : link.target.id;
    const hoveredId = hover?.node.id ?? null;
    if (hoveredId && (src === hoveredId || tgt === hoveredId)) return 'rgba(215,199,112,0.95)';
    if (selectedPath && (src === selectedPath || tgt === selectedPath)) return 'rgba(215,199,112,0.9)';
    return 'rgba(186,200,220,0.55)';
  }, [linkIsDim, hover, selectedPath]);

  const linkWidth = useCallback((link: SimLink) => {
    if (linkIsDim(link)) return 0.15;
    const src = typeof link.source === 'string' ? link.source : link.source.id;
    const tgt = typeof link.target === 'string' ? link.target : link.target.id;
    const hoveredId = hover?.node.id ?? null;
    if (hoveredId && (src === hoveredId || tgt === hoveredId)) return 1;
    if (selectedPath && (src === selectedPath || tgt === selectedPath)) return 0.8;
    return 0.3;
  }, [linkIsDim, hover, selectedPath]);

  const linkArrowColor = useCallback((link: SimLink) => {
    if (linkIsDim(link)) return 'rgba(186,200,220,0.06)';
    const src = typeof link.source === 'string' ? link.source : link.source.id;
    const tgt = typeof link.target === 'string' ? link.target : link.target.id;
    const hoveredId = hover?.node.id ?? null;
    if (hoveredId && (src === hoveredId || tgt === hoveredId)) return 'rgba(215,199,112,0.95)';
    if (selectedPath && (src === selectedPath || tgt === selectedPath)) return 'rgba(215,199,112,0.9)';
    return 'rgba(186,200,220,0.65)';
  }, [linkIsDim, hover, selectedPath]);

  const handleZoomToFit = useCallback(() => { graphRef.current?.zoomToFit(800, 80); }, []);

  const hasData = graphData.nodes.length > 0;
  const showInitialLoading = loading && !hasData;
  const showRefreshOverlay = loading && hasData;
  const showError = !!errorMsg && !hasData;
  const showEmpty = !loading && !errorMsg && !hasData;
  const orphanCount = graphData.nodes.filter((n) => n.degree === 0).length;
  const hoverNeighbors = hover
    ? Array.from(adjacency.get(hover.node.id) ?? []).map((id) => nodesById.get(id)).filter((n): n is SimNode => !!n).sort((a, b) => b.degree - a.degree)
    : [];

  const wrapperClasses = fullscreen
    ? 'fixed inset-0 z-50 flex flex-col bg-rw-surface'
    : 'flex flex-col h-full bg-rw-surface/70 border-l border-rw-gold/10 backdrop-blur-md';

  return (
    <section className={wrapperClasses}>
      <div
        ref={setContainerEl}
        className="flex-1 relative min-h-0 overflow-hidden flex"
        style={{
          background: [
            'radial-gradient(circle at 1px 1px, rgba(215,199,112,0.06) 1px, transparent 0) 0 0 / 28px 28px',
            'radial-gradient(ellipse 60% 45% at 18% 22%, rgba(0,128,128,0.18), transparent 65%)',
            'radial-gradient(ellipse 55% 45% at 82% 78%, rgba(36,57,117,0.22), transparent 65%)',
            'radial-gradient(ellipse 40% 35% at 72% 20%, rgba(0,80,100,0.14), transparent 70%)',
            'linear-gradient(150deg, #0f1e3d 0%, #0d2233 50%, #0a1a1a 100%)',
          ].join(','),
        }}
      >
        {showInitialLoading && (
          <div className="flex-1 flex items-center justify-center text-sm text-rw-gray gap-2">
            <Loader2 size={16} className="animate-spin" /><span>Building graph…</span>
          </div>
        )}
        {showError && (
          <div className="flex-1 flex items-center justify-center text-sm text-red-400 px-6 text-center">
            Failed to build graph. {errorMsg}
          </div>
        )}
        {showEmpty && (
          <div className="flex-1 flex flex-col items-center justify-center text-rw-gray">
            <NotebookText size={40} className="mb-3 opacity-60" />
            <div className="text-sm">No notes to graph yet.</div>
          </div>
        )}
        {showRefreshOverlay && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-md border border-rw-gold/20 bg-rw-surface/85 backdrop-blur text-[11px] text-rw-gray pointer-events-none">
            <Loader2 size={12} className="animate-spin" /><span>Updating…</span>
          </div>
        )}
        {hasData && size.width > 0 && size.height > 0 && (
          <Suspense fallback={null}>
            <ForceGraph3D
              ref={graphRef}
              width={size.width}
              height={size.height}
              graphData={graphData}
              backgroundColor="rgba(0,0,0,0)"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              nodeThreeObject={nodeThreeObject as any}
              nodeThreeObjectExtend={false}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              linkColor={linkColor as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              linkWidth={linkWidth as any}
              linkOpacity={0.85}
              linkDirectionalArrowLength={3}
              linkDirectionalArrowRelPos={0.92}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              linkDirectionalArrowColor={linkArrowColor as any}
              cooldownTicks={200}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onNodeClick={handleNodeClick as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onNodeHover={handleNodeHover as any}
              onBackgroundClick={() => setHover(null)}
              enableNodeDrag={false}
              enableNavigationControls
              controlType="orbit"
              showNavInfo={false}
            />
          </Suspense>
        )}

        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button type="button" onClick={handleZoomToFit}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-rw-gold/25 bg-rw-surface/80 text-rw-foreground hover:bg-rw-surface backdrop-blur">
            <Maximize2 size={14} />Fit
          </button>
          <button type="button" onClick={() => setFullscreen((f) => !f)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-rw-gold/25 bg-rw-surface/80 text-rw-foreground hover:bg-rw-surface backdrop-blur">
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {fullscreen ? 'Exit' : 'Full'}
          </button>
        </div>

        {folderLegendEntries.length > 0 && (
          <div className="absolute top-3 left-3 max-w-[260px] rounded-md border border-rw-gold/20 bg-rw-surface/70 backdrop-blur px-2 py-2 text-[11px] text-rw-gray">
            <div className="flex items-center mb-1.5">
              <span className="font-medium text-rw-foreground">Folders</span>
              {focusedFolderPath && (
                <button type="button" onClick={() => setFocusedFolderPath(null)} className="ml-auto text-[10px] text-rw-gold hover:underline">Clear</button>
              )}
            </div>
            <ul className="space-y-0.5 max-h-[280px] overflow-y-auto rw-scrollbar pr-1">
              {folderLegendEntries.map((entry) => {
                const isActive = focusedFolderPath === entry.path;
                const isExpanded = expandedFolders.has(entry.path);
                return (
                  <li key={entry.path}>
                    <div
                      className={`flex w-full items-center gap-1 rounded px-1 py-0.5 ${isActive ? 'bg-rw-gold/15 text-rw-gold' : 'hover:bg-rw-gold/5 text-rw-foreground/90'}`}
                      style={{ paddingLeft: `${entry.depth * 12 + 4}px` }}
                    >
                      {entry.hasChildren ? (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); setExpandedFolders((prev) => { const next = new Set(prev); if (next.has(entry.path)) next.delete(entry.path); else next.add(entry.path); return next; }); }}
                          className="flex items-center justify-center w-3.5 h-3.5 rounded hover:bg-rw-gold/15 text-rw-gray flex-shrink-0">
                          <span className="inline-block text-[9px] leading-none transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
                        </button>
                      ) : (
                        <span className="inline-block w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <button type="button"
                        onClick={() => { setHover(null); setFocusedFolderPath((prev) => prev === entry.path ? null : entry.path); }}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left">
                        <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: folderChipColor(entry.path), boxShadow: `0 0 6px ${folderChipColor(entry.path)}` }} />
                        <span className="truncate">{entry.label}</span>
                        <span className="ml-auto text-rw-gray/70 pl-1">{entry.count}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="absolute bottom-3 left-3 text-[11px] text-rw-gray/80 bg-rw-surface/60 px-2 py-1 rounded border border-rw-gold/20 backdrop-blur">
          {graphData.nodes.length} notes · {graphData.links.length} links
          {orphanCount > 0 && ` · ${orphanCount} orphans`}
          {focusedFolderPath && ` · focused: ${focusedFolderPath}`}
          {' · drag to rotate · click folder to focus'}
        </div>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-rw-gold/20 bg-rw-surface/95 px-2.5 py-2 shadow-lg text-xs max-w-[280px]"
            style={{ left: hover.x + 12, top: hover.y + 12 }}
          >
            <div className="font-medium text-rw-foreground truncate">{hover.node.title}</div>
            <div className="text-rw-gray mt-0.5">
              {hover.node.scope === 'domain' ? 'Public' : 'Personal'}
              {hover.node.folderPath ? ` · ${hover.node.folderPath}` : ''}
            </div>
            <div className="text-rw-gray/70 mt-0.5">{hover.node.degree} link{hover.node.degree === 1 ? '' : 's'}</div>
            {hoverNeighbors.length > 0 && (
              <div className="mt-1.5 pt-1.5 border-t border-rw-gold/15">
                <div className="text-rw-gray/80 mb-1">Connected:</div>
                <ul className="space-y-0.5">
                  {hoverNeighbors.slice(0, 6).map((n) => <li key={n.id} className="truncate text-rw-foreground/90">· {n.title}</li>)}
                  {hoverNeighbors.length > 6 && <li className="text-rw-gray/60">+{hoverNeighbors.length - 6} more</li>}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
