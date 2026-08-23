/**
 * Lightweight in-platform presentation engine for Rockota decks.
 *
 * No external dependency (deliberately — keeps the bundle lean and the API ours).
 * The authoring surface is intentionally Spectacle-shaped so a future migration
 * is mechanical:
 *
 *   <Deck accent="#008080">
 *     <Slide>...</Slide>
 *     <Slide steps={2}>
 *       <Appear atStep={1}>revealed on first advance</Appear>
 *       <Appear atStep={2}>revealed on second advance</Appear>
 *     </Slide>
 *   </Deck>
 *
 * Navigation: →/Space/click-right = next · ←/click-left = prev · f = fullscreen
 * · Esc = exit to the library. A slide with `steps={n}` holds for n advances
 * (revealing its <Appear atStep> children) before moving on.
 */
import {
  Children,
  createContext,
  isValidElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';

// ── Step context (drives <Appear>) ──────────────────────────────────────────

const StepContext = createContext(0);

export function Appear({ atStep = 1, children }: { atStep?: number; children: ReactNode }) {
  const step = useContext(StepContext);
  const visible = step >= atStep;
  return (
    <span
      style={{
        display: 'block',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 240ms ease, transform 240ms ease',
      }}
      aria-hidden={!visible}
    >
      {children}
    </span>
  );
}

// ── Slide ────────────────────────────────────────────────────────────────────

export interface SlideProps {
  /** How many <Appear> advances this slide holds before the deck moves on. */
  steps?: number;
  /** Optional background override (defaults to the deck theme). */
  background?: string;
  /** Left-align content instead of centering (good for dense/data slides). */
  align?: 'center' | 'left';
  children: ReactNode;
}

export function Slide({ background, align = 'center', children }: SlideProps) {
  return (
    <section
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        textAlign: align === 'center' ? 'center' : 'left',
        padding: 'clamp(32px, 6vw, 96px)',
        ...(background ? { background } : {}),
      }}
    >
      <div style={{ maxWidth: 1000, width: '100%' }}>{children}</div>
    </section>
  );
}

// ── Authoring helpers ────────────────────────────────────────────────────────

export function BigStat({ value, label, accent = '#d7c770' }: { value: string; label: string; accent?: string }) {
  return (
    <div style={{ margin: '8px 0' }}>
      <div style={{ fontSize: 'clamp(44px, 9vw, 108px)', fontWeight: 800, lineHeight: 1, color: accent }}>{value}</div>
      <div style={{ fontSize: 'clamp(16px, 2.2vw, 24px)', color: 'rgba(255,255,255,0.75)', marginTop: 8 }}>{label}</div>
    </div>
  );
}

/** Dependency-free SVG bar chart for data-check slides. */
export function MiniBarChart({
  data,
  accent = '#008080',
  unit = '',
  height = 340,
}: {
  data: { label: string; value: number }[];
  accent?: string;
  unit?: string;
  height?: number;
}) {
  const W = 900;
  const padL = 64;
  const padB = 44;
  const padT = 16;
  const plotW = W - padL - 16;
  const plotH = height - padT - padB;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (plotW / data.length) * 0.6;
  const slot = plotW / data.length;
  const y = (v: number) => padT + (1 - v / max) * plotH;

  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', height: 'auto' }} role="img">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const v = max * f;
        return (
          <g key={f}>
            <line x1={padL} y1={y(v)} x2={W - 16} y2={y(v)} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize={13} fill="rgba(255,255,255,0.55)">
              {Math.round(v).toLocaleString()}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = padL + slot * i + (slot - bw) / 2;
        const h = plotH - (y(d.value) - padT);
        return (
          <g key={d.label}>
            <rect x={x} y={y(d.value)} width={bw} height={Math.max(0, h)} rx={3} fill={accent} />
            <text x={x + bw / 2} y={y(d.value) - 8} textAnchor="middle" fontSize={13} fill="#fff">
              {d.value.toLocaleString()}
              {unit}
            </text>
            <text x={x + bw / 2} y={height - padB + 20} textAnchor="middle" fontSize={13} fill="rgba(255,255,255,0.7)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Deck ──────────────────────────────────────────────────────────────────────

export interface DeckProps {
  accent?: string;
  background?: string;
  children: ReactNode;
}

export function Deck({ accent = '#d7c770', background = '#0f1830', children }: DeckProps) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);

  const slides = Children.toArray(children).filter(isValidElement) as React.ReactElement<SlideProps>[];
  const stepsFor = (i: number) => slides[i]?.props.steps ?? 0;

  const [pos, setPos] = useState<{ slide: number; step: number }>({ slide: 0, step: 0 });

  const next = useCallback(() => {
    setPos((p) => {
      if (p.step < stepsFor(p.slide)) return { slide: p.slide, step: p.step + 1 };
      if (p.slide < slides.length - 1) return { slide: p.slide + 1, step: 0 };
      return p;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  const prev = useCallback(() => {
    setPos((p) => {
      if (p.step > 0) return { slide: p.slide, step: p.step - 1 };
      if (p.slide > 0) return { slide: p.slide - 1, step: stepsFor(p.slide - 1) };
      return p;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        prev();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        if (!document.fullscreenElement) navigate('/library');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, toggleFullscreen, navigate]);

  const totalSteps = slides.reduce((n, _s, i) => n + 1 + stepsFor(i), 0);
  const doneSteps = slides.slice(0, pos.slide).reduce((n, _s, i) => n + 1 + stepsFor(i), 0) + pos.step;
  const progress = totalSteps > 1 ? doneSteps / (totalSteps - 1) : 1;

  return (
    <div
      ref={rootRef}
      onClick={(e) => {
        // Click right 60% = next, left 40% = prev (handy while recording).
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        if (e.clientX - r.left > r.width * 0.4) next();
        else prev();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background,
        color: '#fff',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        cursor: 'default',
        overflow: 'hidden',
      }}
    >
      <StepContext.Provider value={pos.step}>{slides[pos.slide]}</StepContext.Provider>

      {/* Chrome */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: accent }}>ROCKOTA</span>
        <button
          onClick={() => navigate('/library')}
          style={{ pointerEvents: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Esc · back to Library
        </button>
      </div>

      {/* Progress + counter */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <div style={{ height: 3, background: accent, width: `${progress * 100}%`, transition: 'width 200ms ease' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
          <span>← / → to move · F fullscreen</span>
          <span>{pos.slide + 1} / {slides.length}</span>
        </div>
      </div>
    </div>
  );
}
