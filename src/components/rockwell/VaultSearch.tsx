import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Loader2, X, FileText } from 'lucide-react';
import { vaultSearch, SearchHit } from '../../lib/vault-api';

/**
 * Persistent vault search bar.
 *
 * Debounced substring search across the whole vault via /api/vault/search.
 * Scope is enforced server-side: guests search public notes only; an
 * authenticated user searches public + their private notes.
 */
interface VaultSearchProps {
  token: string | null;
  onSelect: (path: string) => void;
}

function basename(p: string): string {
  return (p.split('/').pop() || p).replace(/\.md$/i, '');
}

/** Render `text` with occurrences of `query` highlighted. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'ig'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <span key={i} className="bg-rw-gold/30 text-rw-foreground rounded-[2px]">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function VaultSearch({ token, onSelect }: VaultSearchProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search. Re-runs when the token changes so scope stays correct
  // (e.g. logging in mid-session widens results to include private notes).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const t = setTimeout(() => {
      vaultSearch(q, token, 30, controller.signal)
        .then((j) => {
          setHits(j.hits || []);
          setActiveIdx(0);
          setOpen(true);
          setLoading(false);
        })
        .catch((e) => {
          if ((e as Error).name === 'AbortError') return; // superseded by newer query
          setError((e as Error).message || 'Search failed');
          setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, token]);

  // Close on click outside.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const choose = useCallback(
    (path: string) => {
      onSelect(path);
      setOpen(false);
      inputRef.current?.blur();
    },
    [onSelect],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || hits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[activeIdx] ?? hits[0];
      if (hit) choose(hit.path);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xl min-w-0">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rw-surface/70 border border-rw-gold/15 focus-within:border-rw-gold/40 transition-colors">
        {loading ? (
          <Loader2 size={14} className="text-rw-gold/60 animate-spin shrink-0" />
        ) : (
          <Search size={14} className="text-rw-gold/60 shrink-0" />
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={token ? 'Search all notes…' : 'Search public notes…'}
          className="flex-1 min-w-0 bg-transparent text-sm text-rw-foreground placeholder:text-rw-gray/40 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setHits([]);
              setOpen(false);
              inputRef.current?.focus();
            }}
            className="text-rw-gray/50 hover:text-rw-gold shrink-0"
            title="Clear search"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {open && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-30 rounded-lg border border-rw-gold/15 bg-rw-background shadow-2xl overflow-hidden">
          {error ? (
            <div className="px-4 py-3 text-xs text-red-400">{error}</div>
          ) : hits.length === 0 && !loading ? (
            <div className="px-4 py-3 text-xs text-rw-gray/50">
              No notes match “{query.trim()}”
              {!token && <span className="ml-1">(searching public notes only — log in to include your private vault)</span>}
            </div>
          ) : (
            <ul className="max-h-[50vh] overflow-y-auto divide-y divide-rw-gold/5">
              {hits.map((h, i) => (
                <li key={h.path}>
                  <button
                    onClick={() => choose(h.path)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full text-left px-4 py-2.5 transition-colors ${
                      i === activeIdx ? 'bg-rw-gold/10' : 'hover:bg-rw-gold/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <FileText size={12} className="text-rw-gold/60 shrink-0" />
                      <span className="text-sm text-rw-foreground truncate">
                        <Highlight text={basename(h.path)} query={query} />
                      </span>
                      {h.scope && (
                        <span
                          className={`shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-[1px] rounded border ${
                            h.scope === 'user'
                              ? 'bg-rw-gold/10 text-rw-gold/80 border-rw-gold/25'
                              : 'bg-rw-navy/40 text-rw-gray/70 border-rw-gold/10'
                          }`}
                        >
                          {h.scope === 'user' ? 'private' : 'public'}
                        </span>
                      )}
                      <span className="text-[10px] text-rw-gray/40 truncate ml-auto shrink-0">
                        {h.path}
                      </span>
                    </div>
                    <div className="text-xs text-rw-gray/60 line-clamp-2 pl-5">
                      <Highlight text={h.snippet} query={query} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hits.length > 0 && (
            <div className="px-4 py-1.5 border-t border-rw-gold/10 text-[10px] text-rw-gray/40 flex items-center justify-between">
              <span>{hits.length} result{hits.length === 1 ? '' : 's'}</span>
              <span>{token ? 'public + private' : 'public only'} · ↑↓ navigate · Enter to open</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
