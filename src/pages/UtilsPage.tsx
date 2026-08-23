import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageIcon, LockIcon, PlusIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { listUtils, UtilManifest } from '../lib/api';

// ---------------------------------------------------------------------------
// Orb — the Rockwell mark, matching the home page: the 🪨 in a navy circle
// with a gold border.
// ---------------------------------------------------------------------------
function Orb({ size = 44 }: { size?: number }) {
  return (
    <span
      className="shrink-0 rounded-full bg-[#243975]/90 border border-[#d7c770]/40 flex items-center justify-center"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5), lineHeight: 1 }}
      aria-hidden
    >
      🪨
    </span>
  );
}

// A complete short blurb (first sentence, or a word-boundary trim) — never a
// mid-word cutoff. Returns [blurb, hasMore].
function shortBlurb(text: string, max = 130): [string, boolean] {
  const t = (text ?? '').trim();
  if (t.length <= max) return [t, false];
  const firstSentence = t.split(/(?<=[.!?])\s/)[0];
  if (firstSentence && firstSentence.length <= max && firstSentence.length < t.length) {
    return [firstSentence, true];
  }
  const cut = t.slice(0, max);
  const atWord = cut.slice(0, cut.lastIndexOf(' ')) || cut;
  return [atWord + '…', true];
}

// ---------------------------------------------------------------------------
// UtilCard — one tile with an expandable description
// ---------------------------------------------------------------------------
function UtilCard({ util }: { util: UtilManifest }) {
  const [open, setOpen] = useState(false);
  const desc = util.description ?? '';
  const [blurb, hasMore] = shortBlurb(desc);
  return (
    <div className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 sm:p-6 flex flex-col h-full hover:shadow-md hover:border-[#008080]/40 transition duration-150">
      <div className="flex items-center gap-3 mb-3">
        <Orb size={44} />
        <Link
          to={`/utils/${util.id}`}
          className="text-base sm:text-lg font-semibold text-gray-900 leading-snug min-w-0 line-clamp-2 hover:text-[#008080]"
        >
          {util.name}
        </Link>
      </div>

      <p className="text-sm text-gray-600 leading-relaxed">
        {open ? desc : blurb}
      </p>
      {hasMore && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-1.5 self-start text-xs font-medium text-[#008080] hover:underline"
        >
          {open ? 'Show less' : 'View more details'}
        </button>
      )}

      <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
        {util.source ? (
          <span className="text-[11px] uppercase tracking-wide text-gray-400 truncate">{util.source}</span>
        ) : <span />}
        <Link
          to={`/utils/${util.id}`}
          className="shrink-0 text-sm font-medium text-[#243975] group-hover:text-[#008080] inline-flex items-center gap-1"
        >
          Open
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </div>
  );
}

const UtilsPage = () => {
  const { user, token, loading } = useAuth();
  const [utils, setUtils] = useState<UtilManifest[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setFetching(true);
    listUtils(token)
      .then(setUtils)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load utils'))
      .finally(() => setFetching(false));
  }, [token]);

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  // --- Unauthenticated: coming-soon ------------------------------------------
  if (!user) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-2xl mx-auto py-16">
          <div className="bg-[#243975]/10 p-6 rounded-full inline-flex items-center justify-center mb-6">
            <PackageIcon size={48} className="text-[#243975]" />
          </div>
          <h1 className="text-4xl font-bold text-[#243975] mb-4">Utils</h1>
          <p className="text-xl text-gray-600 mb-8">
            Modular economic data tools — fetch, combine, visualize, and export
            economic data without the spreadsheet busywork.
          </p>
          <div className="p-6 bg-white rounded-lg shadow-lg border border-[#d7c770]/30">
            <h2 className="text-2xl font-semibold text-[#008080] mb-3">Coming Soon</h2>
            <p className="text-gray-600 mb-6">
              Utils are in active development. Sign in to preview what's being built.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center space-x-2 rounded-md bg-[#243975] px-4 py-2 text-white font-medium hover:bg-[#1c2e5e]"
            >
              <LockIcon size={18} />
              <span>Sign in</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- Authenticated: the Utils UI -------------------------------------------
  return (
    <div className="w-full min-h-[70vh] bg-gray-50 px-4 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <div className="bg-[#243975]/10 p-3 rounded-full">
              <PackageIcon size={28} className="text-[#243975]" />
            </div>
            <h1 className="text-3xl font-bold text-[#243975]">Utils</h1>
          </div>
          <button
            disabled
            title="Coming soon"
            className="inline-flex items-center space-x-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed"
          >
            <PlusIcon size={16} />
            <span>New util</span>
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-8">
          Signed in as {user.email}
          {!fetching && ` · ${utils.length} util${utils.length === 1 ? '' : 's'} available`}
        </p>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error} — is the backend running on its configured URL?
          </div>
        )}

        {fetching ? (
          <p className="text-gray-500">Loading utils…</p>
        ) : (
          <>
          <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start">
            {utils.map((util) => (
              <UtilCard key={util.id} util={util} />
            ))}
          </div>

          {!fetching && utils.length === 0 && !error && (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
              <PackageIcon size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No utils available yet.</p>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
};

export default UtilsPage;
