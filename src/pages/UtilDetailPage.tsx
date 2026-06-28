import { useEffect, useMemo, useState, useCallback, ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  RefreshCwIcon,
  DownloadIcon,
  DatabaseIcon,
  TableIcon,
  BarChart3Icon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ViewHost from '../components/ViewHost';
import {
  getUtil,
  listSeries,
  queryObservations,
  refreshUtil,
  getRefreshStatus,
  exportObservations,
  UtilManifest,
  Series,
  Observation,
} from '../lib/api';

const UtilDetailInner = ({ id }: { id: string }) => {
  const { token } = useAuth();

  const [manifest, setManifest] = useState<UtilManifest | null>(null);
  const [series, setSeries] = useState<Series[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [rows, setRows] = useState<Observation[]>([]);
  const [activeTab, setActiveTab] = useState<string>('data');
  const [activeDataset, setActiveDataset] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filters = useMemo(
    () => ({ seriesIds: [...selected], dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    [selected, dateFrom, dateTo],
  );

  const views = useMemo(() => manifest?.views ?? [], [manifest]);

  // Distinct dataset labels (ignoring series with none). A util with 0 or 1
  // shows no selector; multiple shows a dataset picker.
  const datasets = useMemo(
    () => [...new Set(series.map((s) => s.dataset).filter(Boolean))] as string[],
    [series],
  );
  const visibleSeries = useMemo(
    () => (datasets.length ? series.filter((s) => s.dataset === activeDataset) : series),
    [series, datasets, activeDataset],
  );

  const loadMeta = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [m, s] = await Promise.all([getUtil(token, id), listSeries(token, id)]);
      setManifest(m);
      setSeries(s);
      const ds = [...new Set(s.map((x) => x.dataset).filter(Boolean))] as string[];
      const initial = ds[0] ?? null;
      setActiveDataset((prev) => prev ?? initial);
      const firstVisible = (initial ? s.filter((x) => x.dataset === initial) : s)
        .slice(0, 1)
        .map((x) => x.id);
      setSelected((prev) => (prev.size ? prev : new Set(firstVisible)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load util');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  function selectDataset(d: string) {
    setActiveDataset(d);
    setSelected(new Set(series.filter((s) => s.dataset === d).slice(0, 1).map((x) => x.id)));
  }

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (!token || filters.seriesIds.length === 0) {
      setRows([]);
      return;
    }
    queryObservations(token, filters)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Query failed'));
  }, [token, filters]);

  async function handleRefresh() {
    if (!token) return;
    setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      // Fire the job — returns immediately
      await refreshUtil(token, id);

      // Poll until done or error (every 3s, up to 10 min)
      const deadline = Date.now() + 10 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const job = await getRefreshStatus(token, id);
        if (job.status === 'done') {
          setNotice(`Fetched ${job.series_count} series and wrote ${job.observations_written} observations.`);
          await loadMeta();
          return;
        }
        if (job.status === 'error') {
          throw new Error(job.error ?? 'Refresh failed');
        }
        // still running — keep polling
      }
      throw new Error('Refresh timed out after 10 minutes.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleExport() {
    if (!token) return;
    setExporting(true);
    try {
      await exportObservations(token, filters);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  function toggleSeries(sid: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }

  const allSelected = visibleSeries.length > 0 && visibleSeries.every((s) => selected.has(s.id));
  const hasType = rows.some((r) => !!r.obs_type);

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="w-full min-h-[70vh] bg-gray-50 px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <Link to="/utils" className="inline-flex items-center text-sm text-gray-500 hover:text-[#243975] mb-4">
          <ArrowLeftIcon size={16} className="mr-1" /> Back to Utils
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-[#243975]">{manifest?.name ?? id}</h1>
            {manifest?.source && <p className="text-sm text-gray-500 mt-1">Source · {manifest.source}</p>}
          </div>
          {activeTab === 'data' && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center space-x-2 rounded-md bg-[#243975] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c2e5e] disabled:opacity-60"
              >
                <RefreshCwIcon size={16} className={refreshing ? 'animate-spin' : ''} />
                <span>{refreshing ? 'Refreshing…' : 'Refresh data'}</span>
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || rows.length === 0}
                className="inline-flex items-center space-x-2 rounded-md border border-[#008080] px-4 py-2 text-sm font-medium text-[#008080] hover:bg-[#008080]/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <DownloadIcon size={16} />
                <span>{exporting ? 'Exporting…' : 'Export to Excel'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
          <TabButton active={activeTab === 'data'} onClick={() => setActiveTab('data')} icon={<TableIcon size={16} />} label="Data" />
          {views.map((v) => (
            <TabButton
              key={v.id}
              active={activeTab === v.id}
              onClick={() => setActiveTab(v.id)}
              icon={<BarChart3Icon size={16} />}
              label={v.name}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {notice && activeTab === 'data' && (
          <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{notice}</div>
        )}

        {/* View tab */}
        {activeTab !== 'data' && (
          <ViewHost token={token ?? ''} utilId={id} viewId={activeTab} reports={manifest?.reports ?? []} />
        )}

        {/* Data tab */}
        {activeTab === 'data' &&
          (series.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-10 text-center">
              <DatabaseIcon size={40} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-1">No data stored yet.</p>
              <p className="text-sm text-gray-400">
                Click <span className="font-medium">Refresh data</span> to pull the latest from {manifest?.source ?? 'the source'}.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              {/* Filters */}
              <aside className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 h-fit">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Filters</h2>

                {datasets.length > 1 && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Dataset</label>
                    <div className="flex flex-wrap gap-1.5">
                      {datasets.map((d) => (
                        <button
                          key={d}
                          onClick={() => selectDataset(d)}
                          className={`text-xs px-2.5 py-1 rounded-full border ${
                            activeDataset === d
                              ? 'bg-[#243975] text-white border-[#243975]'
                              : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <label className="block text-xs font-medium text-gray-500 mb-1">From date</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full mb-3 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-[#243975] focus:outline-none" />
                <label className="block text-xs font-medium text-gray-500 mb-1">To date</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full mb-4 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-[#243975] focus:outline-none" />
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Series ({visibleSeries.length})</span>
                  <button onClick={() => setSelected(allSelected ? new Set() : new Set(visibleSeries.map((s) => s.id)))} className="text-xs text-[#008080] hover:underline">
                    {allSelected ? 'Clear all' : 'Select all'}
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                  {visibleSeries.map((s) => (
                    <label key={s.id} className="flex items-start space-x-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSeries(s.id)} className="mt-0.5 accent-[#243975]" />
                      <span>{s.title ?? s.code}</span>
                    </label>
                  ))}
                </div>
              </aside>

              {/* Table */}
              <section className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">
                  {rows.length} row{rows.length === 1 ? '' : 's'}
                  {selected.size === 0 && ' · select a series to view data'}
                </div>
                <div className="overflow-x-auto max-h-[60vh]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-left text-gray-500">
                        <th className="px-4 py-2 font-medium">Series</th>
                        <th className="px-4 py-2 font-medium">Period</th>
                        <th className="px-4 py-2 font-medium">Date</th>
                        <th className="px-4 py-2 font-medium text-right">Value</th>
                        <th className="px-4 py-2 font-medium">Unit</th>
                        <th className="px-4 py-2 font-medium">Geography</th>
                        {hasType && <th className="px-4 py-2 font-medium">Type</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-800">{r.series_title}</td>
                          <td className="px-4 py-2 text-gray-600">{r.period_label}</td>
                          <td className="px-4 py-2 text-gray-600">{r.obs_date}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                            {r.value === null ? '—' : r.value.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-gray-500">{r.unit}</td>
                          <td className="px-4 py-2 text-gray-500">{r.geography}</td>
                          {hasType && (
                            <td className="px-4 py-2">
                              {r.obs_type && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  r.obs_type === 'Forecast'
                                    ? 'bg-[#d7c770]/25 text-[#8a7b1f]'
                                    : 'bg-[#008080]/10 text-[#008080]'
                                }`}>
                                  {r.obs_type}
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={hasType ? 7 : 6} className="px-4 py-10 text-center text-gray-400">
                            No observations for the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ))}
      </div>
    </div>
  );
};

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        active ? 'border-[#243975] text-[#243975]' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// Keyed by util id so switching utils fully remounts the page — this resets
// selected series, rows, filters, and active tab (no stale state across utils).
const UtilDetailPage = () => {
  const { id = '' } = useParams();
  return <UtilDetailInner key={id} id={id} />;
};

export default UtilDetailPage;
