import { useEffect, useMemo, useState, useCallback, ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  RefreshCwIcon,
  DownloadIcon,
  DatabaseIcon,
  TableIcon,
  BarChart3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ViewHost from '../components/ViewHost';
import {
  getUtil,
  listSeries,
  queryObservations,
  countObservations,
  refreshUtil,
  getRefreshStatus,
  exportObservations,
  listTables,
  getTable,
  UtilManifest,
  Series,
  Observation,
  DataTableMeta,
  DataTable,
} from '../lib/api';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 200;

// ---------------------------------------------------------------------------
// SeriesTable — fetches + paginates a single series
// ---------------------------------------------------------------------------
interface SeriesTableProps {
  token: string;
  series: Series;
  dateFrom: string;
  dateTo: string;
}

function SeriesTable({ token, series, dateFrom, dateTo }: SeriesTableProps) {
  const [rows, setRows] = useState<Observation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const baseFilters = useMemo(
    () => ({ seriesIds: [series.id], dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    [series.id, dateFrom, dateTo],
  );

  useEffect(() => {
    setPage(0);
    countObservations(token, baseFilters).then(setTotal).catch(() => setTotal(0));
  }, [token, baseFilters]);

  useEffect(() => {
    setLoading(true);
    queryObservations(token, { ...baseFilters, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((r) => { setRows(r); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, baseFilters, page]);

  const hasType = rows.some((r) => !!r.obs_type);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {total.toLocaleString()} row{total === 1 ? '' : 's'}
          {series.unit && <> · {series.unit}</>}
        </span>
        <div className="flex items-center gap-3">
          {!!series.metadata?.source_url && (
            <a href={String(series.metadata.source_url)} target="_blank" rel="noreferrer"
              className="text-xs text-[#243975] hover:underline">
              View source ↗
            </a>
          )}
          {total > PAGE_SIZE && (
            <span className="text-xs text-gray-400">page {page + 1} of {totalPages}</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto max-h-[60vh]">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-2 font-medium">Period</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Geography</th>
              <th className="px-4 py-2 font-medium text-right">Value</th>
              {hasType && <th className="px-4 py-2 font-medium">Type</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={hasType ? 5 : 4} className="px-4 py-10 text-center text-gray-400 text-xs">Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={hasType ? 5 : 4} className="px-4 py-10 text-center text-gray-400 text-xs">No data for the current filters.</td>
              </tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-600">{r.period_label}</td>
                <td className="px-4 py-2 text-gray-600">{r.obs_date}</td>
                <td className="px-4 py-2 text-gray-500">{r.geography}</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                  {r.value === null ? '—' : r.value.toLocaleString()}
                </td>
                {hasType && (
                  <td className="px-4 py-2">
                    {r.obs_type && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        r.obs_type === 'Forecast' ? 'bg-[#d7c770]/25 text-[#8a7b1f]' : 'bg-[#008080]/10 text-[#008080]'
                      }`}>
                        {r.obs_type}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-gray-100">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeftIcon size={16} />
          </button>
          <span className="text-xs text-gray-500">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))} disabled={page + 1 >= totalPages}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRightIcon size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
// Renders one wide/multi-column table (columns + rows) as a scrollable grid.
function DataTableView({ token, utilId, meta }: { token: string; utilId: string; meta: DataTableMeta }) {
  const [table, setTable] = useState<DataTable | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!token) return;
    getTable(token, utilId, meta.code)
      .then(setTable)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load table'));
  }, [token, utilId, meta.code]);

  const cols = table?.columns ?? [];
  const hasYear = cols.some((c) => c.key === 'year');

  const filtered = useMemo(() => {
    let rows = table?.rows ?? [];
    const q = query.trim().toLowerCase();
    if (q) rows = rows.filter((r) => cols.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)));
    if (hasYear && (yearFrom || yearTo)) {
      const yf = yearFrom ? Number(yearFrom) : null;
      const yt = yearTo ? Number(yearTo) : null;
      rows = rows.filter((r) => {
        const y = Number(r['year']);
        if (Number.isNaN(y)) return false;
        if (yf != null && y < yf) return false;
        if (yt != null && y > yt) return false;
        return true;
      });
    }
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        const an = typeof av === 'number' ? av : Number(av);
        const bn = typeof bv === 'number' ? bv : Number(bv);
        if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== '') return (an - bn) * dir;
        return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
      });
    }
    return rows;
  }, [table, query, yearFrom, yearTo, sortKey, sortDir, cols, hasYear]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function exportXlsx() {
    if (!table) return;
    setExporting(true);
    try {
      const keys = cols.map((c) => c.key);
      const header = cols.map((c) => c.label ?? c.key);
      const aoa = [header, ...filtered.map((r) => keys.map((k) => (r[k] == null ? '' : r[k])))];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, (meta.code || 'table').slice(0, 31));
      XLSX.writeFile(wb, `${utilId}_${meta.code}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  const total = table?.rows.length ?? 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6">
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-[#243975]">{meta.title || meta.code}</h3>
          <p className="text-xs text-gray-500">
            {filtered.length === total ? `${total} rows` : `${filtered.length} of ${total} rows`} · {meta.n_columns} columns
          </p>
        </div>
        {table && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter rows…"
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md w-44 focus:outline-none focus:ring-1 focus:ring-[#008080]"
              />
            </div>
            {hasYear && (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <input value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} placeholder="From" inputMode="numeric"
                  className="w-16 px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#008080]" />
                <span>–</span>
                <input value={yearTo} onChange={(e) => setYearTo(e.target.value)} placeholder="To" inputMode="numeric"
                  className="w-16 px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#008080]" />
              </div>
            )}
            <button onClick={exportXlsx} disabled={exporting || filtered.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#008080] px-3 py-1.5 text-sm font-medium text-[#008080] hover:bg-[#008080]/10 disabled:opacity-50">
              <DownloadIcon size={14} />
              <span>{exporting ? 'Exporting…' : 'Export to Excel'}</span>
            </button>
          </div>
        )}
      </div>
      {err ? (
        <p className="p-4 text-sm text-red-600">{err}</p>
      ) : !table ? (
        <p className="p-4 text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {cols.map((c) => (
                  <th key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer select-none hover:text-[#243975]">
                    {c.label ?? c.key}
                    {sortKey === c.key && <span className="ml-1 text-[#008080]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i} className="border-t border-gray-100">
                  {cols.map((c) => (
                    <td key={c.key} className="px-3 py-1.5 whitespace-nowrap text-gray-800">{row[c.key] == null ? '' : String(row[c.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const UtilDetailInner = ({ id }: { id: string }) => {
  const { token } = useAuth();

  const [manifest, setManifest] = useState<UtilManifest | null>(null);
  const [series, setSeries] = useState<Series[]>([]);
  const [tables, setTables] = useState<DataTableMeta[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Top-level tabs: 'data' or a view id
  const [activeTab, setActiveTab] = useState<string>('data');
  // Dataset picker (e.g. "Colorado Counties" / "States" / "National")
  const [activeDataset, setActiveDataset] = useState<string | null>(null);
  // Series sub-tab within the active dataset
  const [activeSeries, setActiveSeries] = useState<number | null>(null);
  // Table search within the active dataset's sidebar
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const views = useMemo(() => manifest?.views ?? [], [manifest]);

  const datasets = useMemo(
    () => [...new Set(series.map((s) => s.dataset).filter(Boolean))] as string[],
    [series],
  );

  const visibleSeries = useMemo(
    () => (datasets.length ? series.filter((s) => s.dataset === activeDataset) : series),
    [series, datasets, activeDataset],
  );

  const currentSeries = useMemo(
    () => visibleSeries.find((s) => s.id === activeSeries) ?? null,
    [visibleSeries, activeSeries],
  );

  const filteredSeries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleSeries;
    return visibleSeries.filter((s) => (s.title ?? s.code ?? '').toLowerCase().includes(q));
  }, [visibleSeries, search]);

  const loadMeta = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [m, s, t] = await Promise.all([
        getUtil(token, id),
        listSeries(token, id),
        listTables(token, id).catch(() => [] as DataTableMeta[]),
      ]);
      setManifest(m);
      setSeries(s);
      setTables(t);
      // If a util has no series but has wide tables, land on the Tables tab.
      if (s.length === 0 && t.length > 0) setActiveTab('tables');
      const ds = [...new Set(s.map((x) => x.dataset).filter(Boolean))] as string[];
      const initial = ds[0] ?? null;
      setActiveDataset((prev) => prev ?? initial);
      const firstInDataset = (initial ? s.filter((x) => x.dataset === initial) : s)[0];
      setActiveSeries((prev) => prev ?? firstInDataset?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load util');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  function selectDataset(d: string) {
    setActiveDataset(d);
    setSearch('');
    const first = series.find((s) => s.dataset === d);
    setActiveSeries(first?.id ?? null);
  }

  async function handleRefresh() {
    if (!token) return;
    setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      await refreshUtil(token, id);
      const deadline = Date.now() + 10 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const job = await getRefreshStatus(token, id);
        if (job.status === 'done') {
          setNotice(`Fetched ${job.series_count} series and wrote ${job.observations_written} observations.`);
          await loadMeta();
          return;
        }
        if (job.status === 'error') throw new Error(job.error ?? 'Refresh failed');
      }
      throw new Error('Refresh timed out after 10 minutes.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleExport() {
    if (!token || !activeSeries) return;
    setExporting(true);
    try {
      await exportObservations(token, {
        seriesIds: [activeSeries],
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center text-gray-500">Loading…</div>
    );
  }

  return (
    <div className="w-full min-h-[70vh] bg-gray-50 px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <Link to="/utils" className="inline-flex items-center text-sm text-gray-500 hover:text-[#243975] mb-4">
          <ArrowLeftIcon size={16} className="mr-1" /> Back to Utils
        </Link>

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-[#243975]">{manifest?.name ?? id}</h1>
            {manifest?.sources && manifest.sources.length > 0 ? (
              <p className="text-sm text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                {manifest.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer"
                    className="hover:text-[#243975] underline underline-offset-2">{s.name}</a>
                ))}
              </p>
            ) : manifest?.source && (
              <p className="text-sm text-gray-500 mt-1">Source · {manifest.source}</p>
            )}
            {manifest?.description && <p className="text-sm text-gray-400 mt-0.5 max-w-2xl">{manifest.description}</p>}
          </div>
          {activeTab === 'data' && (
            <div className="flex items-center gap-3">
              <button onClick={handleRefresh} disabled={refreshing}
                className="inline-flex items-center space-x-2 rounded-md bg-[#243975] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c2e5e] disabled:opacity-60">
                <RefreshCwIcon size={16} className={refreshing ? 'animate-spin' : ''} />
                <span>{refreshing ? 'Refreshing…' : 'Refresh data'}</span>
              </button>
              <button onClick={handleExport} disabled={exporting || !activeSeries}
                className="inline-flex items-center space-x-2 rounded-md border border-[#008080] px-4 py-2 text-sm font-medium text-[#008080] hover:bg-[#008080]/10 disabled:opacity-50 disabled:cursor-not-allowed">
                <DownloadIcon size={16} />
                <span>{exporting ? 'Exporting…' : 'Export to Excel'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Top-level tabs */}
        <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
          {(series.length > 0 || tables.length === 0) && (
            <TabButton active={activeTab === 'data'} onClick={() => setActiveTab('data')} icon={<TableIcon size={16} />} label="Data" />
          )}
          {tables.length > 0 && (
            <TabButton active={activeTab === 'tables'} onClick={() => setActiveTab('tables')} icon={<TableIcon size={16} />} label="Tables" />
          )}
          {views.map((v) => (
            <TabButton key={v.id} active={activeTab === v.id} onClick={() => setActiveTab(v.id)} icon={<BarChart3Icon size={16} />} label={v.name} />
          ))}
        </div>

        {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && activeTab === 'data' && <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">{notice}</div>}

        {/* Tables tab (wide/multi-column) */}
        {activeTab === 'tables' && (
          <div>
            {tables.map((t) => (
              <DataTableView key={t.code} token={token ?? ''} utilId={id} meta={t} />
            ))}
          </div>
        )}

        {/* View tab */}
        {activeTab !== 'data' && activeTab !== 'tables' && (
          <ViewHost token={token ?? ''} utilId={id} viewId={activeTab} reports={manifest?.reports ?? []} />
        )}

        {/* Data tab */}
        {activeTab === 'data' && (
          series.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-10 text-center">
              <DatabaseIcon size={40} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-1">No data stored yet.</p>
              <p className="text-sm text-gray-400">
                Click <span className="font-medium">Refresh data</span> to pull the latest from {manifest?.source ?? 'the source'}.
              </p>
            </div>
          ) : (
            <div>
              {/* Dataset picker */}
              {datasets.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {datasets.map((d) => (
                    <button key={d} onClick={() => selectDataset(d)}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium ${
                        activeDataset === d
                          ? 'bg-[#243975] text-white border-[#243975]'
                          : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              )}

              {/* Table browser: searchable sidebar + table */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* Sidebar: list of tables in this dataset */}
                <aside className="md:w-72 shrink-0">
                  {visibleSeries.length > 6 && (
                    <div className="relative mb-2">
                      <SearchIcon size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={`Search ${visibleSeries.length} tables…`}
                        className="w-full rounded-md border border-gray-300 pl-8 pr-2 py-1.5 text-sm focus:border-[#243975] focus:outline-none"
                      />
                    </div>
                  )}
                  <div className="border border-gray-200 rounded-lg bg-white overflow-hidden max-h-[70vh] overflow-y-auto divide-y divide-gray-100">
                    {filteredSeries.length === 0 ? (
                      <div className="px-3 py-6 text-center text-xs text-gray-400">No tables match “{search}”.</div>
                    ) : filteredSeries.map((s) => {
                      const active = activeSeries === s.id;
                      return (
                        <button key={s.id} onClick={() => setActiveSeries(s.id)}
                          className={`w-full text-left px-3 py-2.5 border-l-[3px] transition-colors ${
                            active
                              ? 'border-l-[#008080] bg-[#008080]/8'
                              : 'border-l-transparent hover:bg-gray-50'
                          }`}>
                          <div className={`text-sm leading-snug ${active ? 'text-[#008080] font-medium' : 'text-gray-700'}`}>
                            {s.title ?? s.code}
                          </div>
                          {(s.frequency || s.unit) && (
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              {[s.frequency, s.unit].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </aside>

                {/* Right column: filters + table */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
                      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-[#243975] focus:outline-none" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
                      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-[#243975] focus:outline-none" />
                    </div>
                    {(dateFrom || dateTo) && (
                      <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                        className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
                    )}
                  </div>

                  {currentSeries ? (
                    <>
                      <h3 className="text-base font-semibold text-[#243975] mb-2">{currentSeries.title ?? currentSeries.code}</h3>
                      <SeriesTable
                        key={currentSeries.id}
                        token={token ?? ''}
                        series={currentSeries}
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                      />
                    </>
                  ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-10 text-center text-gray-400 text-sm">
                      Select a table to view data.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        active ? 'border-[#243975] text-[#243975]' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

const UtilDetailPage = () => {
  const { id = '' } = useParams();
  return <UtilDetailInner key={id} id={id} />;
};

export default UtilDetailPage;
