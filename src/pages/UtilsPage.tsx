import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageIcon, LineChartIcon, LockIcon, PlusIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { listUtils, UtilManifest } from '../lib/api';

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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {utils.map((util) => (
              <Link
                key={util.id}
                to={`/utils/${util.id}`}
                className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 flex flex-col hover:shadow-md hover:border-[#008080]/40 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="bg-[#008080]/10 p-3 rounded-lg">
                    <LineChartIcon size={24} className="text-[#008080]" />
                  </div>
                  {util.source && (
                    <span className="text-xs uppercase tracking-wide text-gray-400 mt-1">
                      {util.source}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{util.name}</h3>
                <p className="text-sm text-gray-600 mt-1 flex-grow">
                  {util.description}
                </p>
                <span className="mt-5 text-sm font-medium text-[#243975]">
                  Open util →
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UtilsPage;
