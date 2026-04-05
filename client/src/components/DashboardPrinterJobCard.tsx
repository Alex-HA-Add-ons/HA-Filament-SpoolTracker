import { Link } from 'react-router-dom';
import type { PrintJob } from '@ha-addon/types';
import { getApiBaseURL } from '../services/api';
import ProgressBar from './ProgressBar';
import './PrintJobCard.css';
import './DashboardPrinterJobCard.css';

function projectImageSrc(projectImage: string | null): string | undefined {
  if (!projectImage) return undefined;
  if (projectImage.startsWith('http://') || projectImage.startsWith('https://')) return projectImage;
  const base = getApiBaseURL();
  return base.endsWith('/') ? base + projectImage.replace(/^\//, '') : base + (projectImage.startsWith('/') ? projectImage : '/' + projectImage);
}

function parseFilamentGrams(live: string | null | undefined, jobUsed: number | null | undefined): number | null {
  if (live != null && String(live).trim() !== '') {
    const cleaned = String(live).replace(/g/gi, '').trim();
    const n = parseFloat(cleaned);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  if (jobUsed != null && !Number.isNaN(jobUsed) && jobUsed >= 0) return jobUsed;
  return null;
}

function formatGrams(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Math.round(n)}g`;
}

function formatDurationShort(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0 && min > 0) return `${h}h ${min}m`;
  if (h > 0) return `${h}h`;
  return `${min}m`;
}

/** Home Assistant often sends decimal *hours*, raw seconds, or strings like H:MM:SS — normalize for display. */
function formatEtaDisplay(raw: string | null | undefined): string {
  const s = raw != null ? String(raw).trim() : '';
  if (!s) return '—';

  const lower = s.toLowerCase();
  if (lower === 'unknown' || lower === 'unavailable' || lower === 'none') return '—';

  if (/^\d{1,3}:\d{2}(:\d{2})?$/.test(s)) return s;

  const n = parseFloat(s);
  if (Number.isNaN(n) || n < 0) return s;
  if (n === 0) return '0m';

  // Decimal hours (e.g. 1.11666666666667 from Bambu-style sensors)
  if (n < 168 && /\d\.\d/.test(s)) {
    return formatDurationShort(n * 60);
  }

  return s;
}

/** Same date display as PrintJobCard meta line. */
function formatMetaDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface DashboardPrinterJobCardProps {
  job: PrintJob | null;
  live?: { eta: string | null; filamentGrams: string | null } | null;
  /** Grams left on the spool loaded on this printer (dashboard row). */
  loadedSpoolRemainingGrams?: number | null;
}

export default function DashboardPrinterJobCard({ job, live, loadedSpoolRemainingGrams }: DashboardPrinterJobCardProps) {
  if (!job) {
    return (
      <div className="dashboard-printer-job-card dashboard-printer-job-card--idle">
        <span className="dashboard-printer-job-idle">No active print</span>
        <Link to="/history" className="dashboard-printer-job-link">History</Link>
      </div>
    );
  }

  const img = projectImageSrc(job.projectImage);
  const hasProgress = job.progress != null && !Number.isNaN(job.progress);
  const progress = hasProgress ? job.progress! : 0;
  const eta =
    live?.eta != null && String(live.eta).trim() !== ''
      ? formatEtaDisplay(String(live.eta).trim())
      : '—';

  const totalGrams = parseFilamentGrams(live?.filamentGrams, job.filamentUsed);
  const pPct = hasProgress ? Math.min(100, Math.max(0, progress)) : null;
  const usedGramsRounded =
    totalGrams != null && pPct != null ? Math.round(totalGrams * (pPct / 100)) : null;

  const spoolLessThanJobTotal =
    loadedSpoolRemainingGrams != null &&
    totalGrams != null &&
    loadedSpoolRemainingGrams < totalGrams;

  const spoolShortTitle =
    spoolLessThanJobTotal && loadedSpoolRemainingGrams != null && totalGrams != null
      ? `Loaded spool has ${Math.round(loadedSpoolRemainingGrams)}g left, less than this job total (${Math.round(totalGrams)}g).`
      : undefined;

  const startedTitle = (() => {
    const d = new Date(job.startedAt);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
  })();

  return (
    <div
      className={`dashboard-printer-job-card${spoolLessThanJobTotal ? ' dashboard-printer-job-card--spool-short' : ''}`}
      title={spoolShortTitle}
    >
      <div className="dashboard-printer-job-media">
        {img ? (
          <img src={img} alt="" className="dashboard-printer-job-image" />
        ) : (
          <div className="dashboard-printer-job-image dashboard-printer-job-image--placeholder" aria-hidden />
        )}
      </div>
      <div className="dashboard-printer-job-body">
        <div className="dashboard-printer-job-head">
          <h4 className="dashboard-printer-job-title" title={job.projectName}>{job.projectName}</h4>
          <Link to="/history?status=in_progress" className="dashboard-printer-job-link">Open</Link>
        </div>
        <div className="dashboard-printer-job-progress">
          <ProgressBar
            value={progress}
            max={100}
            size="sm"
            showPercent
            indeterminate={!hasProgress}
          />
          <span
            className="dashboard-printer-job-progress-used"
            title="Filament used (total × progress %, rounded)"
          >
            {formatGrams(usedGramsRounded)}
          </span>
        </div>
        <div className="print-job-meta">
          {job.printer && (
            <span className="meta-item">
              Printer:{' '}
              <Link
                to={`/printers?focus=${encodeURIComponent(job.printer.id)}`}
                className="print-job-spool-link"
                title="Open Printers and scroll to this printer"
              >
                {job.printer.name}
              </Link>
            </span>
          )}
          {job.spool ? (
            <span className="meta-item">
              <span
                className="spool-dot"
                style={{ backgroundColor: job.spool.colorHex || job.spool.color }}
                aria-hidden
              />
              <Link
                to={`/spools/${job.spool.id}`}
                className="print-job-spool-link"
                title={job.spool.filamentType}
              >
                {job.spool.name}
              </Link>
            </span>
          ) : null}
          {totalGrams != null && (
            <span className="meta-item" title="From printer / Home Assistant">
              {Math.round(totalGrams)}g total
            </span>
          )}
          <span className="meta-item">ETA {eta}</span>
          <span className="meta-item meta-date" title={startedTitle}>
            {formatMetaDate(job.startedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
