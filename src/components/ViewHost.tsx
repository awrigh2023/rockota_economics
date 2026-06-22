import { useEffect, useRef, useState } from 'react';
import { FileTextIcon } from 'lucide-react';
import { renderView, downloadReport, UtilReport } from '../lib/api';

/**
 * Generic host for a util's server-rendered Python view.
 *
 * The view returns an HTML fragment whose controls live inside a
 * <form data-view-form>. This host displays the fragment and, whenever a
 * control changes, serializes that form and re-requests a render with the new
 * params — HTMX-style partial updates. The host is util-agnostic; all
 * view-specific logic lives in the util's Python.
 *
 * Note: we attach a NATIVE 'change' listener to the container rather than using
 * React's onChange. React's synthetic onChange does not fire for inputs injected
 * via dangerouslySetInnerHTML (its change-detection relies on a value tracker it
 * only installs on inputs React itself renders).
 */
interface Props {
  token: string;
  utilId: string;
  viewId: string;
  reports?: UtilReport[];
}

function serializeForm(form: HTMLFormElement): Record<string, string[]> {
  const fd = new FormData(form);
  const params: Record<string, string[]> = {};
  for (const key of new Set(fd.keys())) {
    params[key] = fd.getAll(key).map(String);
  }
  return params;
}

const ViewHost = ({ token, utilId, viewId, reports = [] }: Props) => {
  const [params, setParams] = useState<Record<string, string[]>>({});
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  async function handleReport(reportId: string) {
    setDownloading(reportId);
    setError(null);
    try {
      await downloadReport(token, utilId, reportId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Report download failed');
    } finally {
      setDownloading(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    renderView(token, utilId, viewId, params)
      .then((h) => !cancelled && setHtml(h))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Render failed'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, utilId, viewId, params]);

  // Native change listener — fires for the server-rendered (non-React) inputs.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const form = (e.target as HTMLElement)?.closest('form[data-view-form]') as HTMLFormElement | null;
      if (form) setParams(serializeForm(form));
    };
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, []);

  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 relative">
      {loading && <p className="text-gray-400 text-sm absolute right-6 top-6">Updating…</p>}

      {reports.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => handleReport(r.id)}
              disabled={downloading === r.id}
              className="inline-flex items-center space-x-2 rounded-md border border-[#243975] px-3 py-1.5 text-sm font-medium text-[#243975] hover:bg-[#243975]/10 disabled:opacity-60"
            >
              <FileTextIcon size={15} />
              <span>{downloading === r.id ? 'Generating…' : `Download ${r.name} (PDF)`}</span>
            </button>
          ))}
        </div>
      )}

      {/* Trusted, server-rendered HTML from our own util (single-author trust model). */}
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

export default ViewHost;
