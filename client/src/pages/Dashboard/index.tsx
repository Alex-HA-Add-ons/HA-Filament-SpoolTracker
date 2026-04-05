import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, printersApi } from '@services/api';
import type { DashboardStats, Printer, PrintJob } from '@ha-addon/types';
import PrintJobCard from '@components/PrintJobCard';
import DashboardPrinterJobCard from '@components/DashboardPrinterJobCard';
import ProgressBar from '@components/ProgressBar';
import SpoolSelect from '@components/SpoolSelect';
import './index.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await dashboardApi.getStats();
      setStats(response.data);
      setError(null);
    } catch {
      setError('Failed to load dashboard data');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await fetchStats();
      if (cancelled) return;
      const interval = setInterval(fetchStats, 15000);
      if (cancelled) clearInterval(interval);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [fetchStats]);

  const jobByPrinterId = useMemo(() => {
    if (!stats) return new Map<string, PrintJob>();
    const jobs = stats.activeInProgressPrintJobs ?? [];
    const m = new Map<string, PrintJob>();
    for (const j of jobs) {
      if (!j.printerId) continue;
      const prev = m.get(j.printerId);
      if (!prev || new Date(j.startedAt) > new Date(prev.startedAt)) m.set(j.printerId, j);
    }
    return m;
  }, [stats]);

  const liveByPrinter = useMemo(
    () => (!stats ? {} : (stats.printerJobLiveMetrics ?? {})),
    [stats],
  );

  const handlePrinterLoadedSpoolChange = async (printer: Printer, activeSpoolId: string | null) => {
    if (!stats) return;
    try {
      const res = await printersApi.update(printer.id, { activeSpoolId });
      setStats({
        ...stats,
        printersList: stats.printersList.map((p) => (p.id === printer.id ? res.data : p)),
      });
    } catch {
      fetchStats();
    }
  };

  if (error) {
    return (
      <div className="dashboard">
        <div className="error-card">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dashboard">
        <div className="loading-container"><div className="spinner" /><p>Loading dashboard...</p></div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <button
          type="button"
          className="stat-card stat-card-clickable"
          onClick={() => navigate('/printers')}
        >
          <span className="stat-value">{stats.registeredPrinters}</span>
          <span className="stat-label">Printers</span>
        </button>
        <button
          type="button"
          className="stat-card stat-card-clickable"
          onClick={() => navigate('/spools')}
        >
          <span className="stat-value">{stats.totalSpools}</span>
          <span className="stat-label">Spools</span>
        </button>
        <button
          type="button"
          className="stat-card stat-card-clickable"
          onClick={() => navigate('/spools?filter=all')}
        >
          <span className="stat-value">{(stats.totalFilamentStock / 1000).toFixed(1)}kg</span>
          <span className="stat-label">Filament Stock</span>
        </button>
        <button
          type="button"
          className="stat-card stat-card-clickable"
          onClick={() => navigate('/history?status=in_progress')}
        >
          <span className="stat-value">{stats.activePrintJobs}</span>
          <span className="stat-label">Printing Now</span>
        </button>
        <button
          type="button"
          className={`stat-card stat-card-clickable ${stats.lowFilamentAlerts > 0 ? 'stat-warning' : ''}`}
          onClick={() => navigate('/spools?filter=low')}
        >
          <span className="stat-value">{stats.lowFilamentAlerts}</span>
          <span className="stat-label">Low Filament</span>
        </button>
      </div>

      {stats.printersList?.length > 0 && (
        <div className="dashboard-section">
          <h3 className="section-title">Active Spools</h3>
          <div className="active-spools-grid">
            {stats.printersList.map((printer) => (
              <div key={printer.id} className="printer-dashboard-row">
                <div className="printer-with-spool-card">
                  <span className="printer-with-spool-name">{printer.name}</span>
                  <SpoolSelect
                    value={printer.activeSpoolId ?? null}
                    onChange={(id) => handlePrinterLoadedSpoolChange(printer, id)}
                    spools={stats.spoolsList ?? []}
                    placeholder="Select spool…"
                    size="sm"
                    className={printer.activeSpool ? '' : 'spool-select-empty'}
                    aria-label={printer.activeSpool ? 'Change loaded spool' : 'Select loaded spool'}
                    renderTrigger={() => (printer.activeSpool ? (
                      <div className="active-spool-trigger-content">
                        <div className="active-spool-header">
                          <span className="active-spool-dot" style={{ backgroundColor: printer.activeSpool.colorHex || printer.activeSpool.color }} />
                          <div className="active-spool-info">
                            <span className="active-spool-name">{printer.activeSpool.name}</span>
                            <span className="active-spool-type">{printer.activeSpool.filamentType}</span>
                          </div>
                          <a
                            href={`/spools/${printer.activeSpool.id}`}
                            className="active-spool-view-link"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate(`/spools/${printer.activeSpool!.id}`);
                            }}
                          >
                            View
                          </a>
                        </div>
                        <div className="active-spool-weight">
                          <span className="active-spool-remaining">{Math.round(printer.activeSpool.remainingWeight)}g</span>
                          <span className="active-spool-total"> / {Math.round(printer.activeSpool.initialWeight)}g</span>
                        </div>
                        <ProgressBar value={printer.activeSpool.remainingWeight} max={printer.activeSpool.initialWeight} size="sm" />
                      </div>
                    ) : (
                      <span className="spool-select-placeholder">No spool loaded — click to select</span>
                    ))}
                  />
                </div>
                <DashboardPrinterJobCard
                  job={jobByPrinterId.get(printer.id) ?? null}
                  live={liveByPrinter[printer.id]}
                  loadedSpoolRemainingGrams={printer.activeSpool?.remainingWeight ?? null}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.lowFilamentSpools.length > 0 && (
        <div className="dashboard-section">
          <h3 className="section-title">Low Filament Warnings</h3>
          <div className="low-filament-list">
            {stats.lowFilamentSpools.map((spool) => (
              <button
                key={spool.id}
                type="button"
                className="low-filament-item low-filament-item-clickable"
                onClick={() => navigate(`/spools/${spool.id}`)}
              >
                <div className="low-filament-info">
                  <span className="spool-dot-inline" style={{ backgroundColor: spool.colorHex || spool.color }} />
                  <span className="low-filament-name">{spool.name}</span>
                  <span className="low-filament-type">{spool.filamentType}</span>
                </div>
                <div className="low-filament-bar">
                  <ProgressBar value={spool.remainingWeight} max={spool.initialWeight} size="sm" />
                  <span className="low-filament-weight">{Math.round(spool.remainingWeight)}g</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {stats.recentPrintJobs.length > 0 && (
        <div className="dashboard-section">
          <h3 className="section-title">Recent Print Jobs</h3>
          <div className="recent-jobs-list">
            {stats.recentPrintJobs.slice(0, 5).map((job) => (
              <PrintJobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
