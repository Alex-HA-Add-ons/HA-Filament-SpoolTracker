import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, printersApi } from '@services/api';
import type { DashboardStats, Printer } from '@ha-addon/types';
import PrintJobCard from '@components/PrintJobCard';
import ProgressBar from '@components/ProgressBar';
import './index.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const response = await dashboardApi.getStats();
      setStats(response.data);
      setError(null);
    } catch {
      setError('Failed to load dashboard data');
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

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
        <h2 className="page-title">Dashboard</h2>
        <div className="error-card">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dashboard">
        <h2 className="page-title">Dashboard</h2>
        <div className="loading-container"><div className="spinner" /><p>Loading dashboard...</p></div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h2 className="page-title">Dashboard</h2>
      <p className="page-subtitle">Overview of your filament inventory and print activity</p>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.registeredPrinters}</span>
          <span className="stat-label">Printers</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.totalSpools}</span>
          <span className="stat-label">Spools</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{(stats.totalFilamentStock / 1000).toFixed(1)}kg</span>
          <span className="stat-label">Filament Stock</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.activePrintJobs}</span>
          <span className="stat-label">Printing Now</span>
        </div>
        <div className={`stat-card ${stats.lowFilamentAlerts > 0 ? 'stat-warning' : ''}`}>
          <span className="stat-value">{stats.lowFilamentAlerts}</span>
          <span className="stat-label">Low Filament</span>
        </div>
      </div>

      {stats.printersList?.length > 0 && (
        <div className="dashboard-section">
          <h3 className="section-title">Active Spools</h3>
          <div className="active-spools-grid">
            {stats.printersList.map((printer) => (
              <div key={printer.id} className="printer-with-spool-card">
                <span className="printer-with-spool-name">{printer.name}</span>
                {printer.activeSpool ? (
                  <>
                    <button
                      type="button"
                      className="active-spool-card active-spool-card-clickable active-spool-card-inside"
                      onClick={() => navigate(`/spools/${printer.activeSpool!.id}`)}
                    >
                      <div className="active-spool-header">
                        <span className="active-spool-dot" style={{ backgroundColor: printer.activeSpool.colorHex || printer.activeSpool.color }} />
                        <div className="active-spool-info">
                          <span className="active-spool-name">{printer.activeSpool.name}</span>
                          <span className="active-spool-type">{printer.activeSpool.filamentType}</span>
                        </div>
                      </div>
                      <div className="active-spool-weight">
                        <span className="active-spool-remaining">{Math.round(printer.activeSpool.remainingWeight)}g</span>
                        <span className="active-spool-total"> / {Math.round(printer.activeSpool.initialWeight)}g</span>
                      </div>
                      <ProgressBar value={printer.activeSpool.remainingWeight} max={printer.activeSpool.initialWeight} size="sm" />
                    </button>
                    <select
                      className="printer-loaded-select printer-loaded-select-sm"
                      value={printer.activeSpoolId ?? ''}
                      onChange={(e) => handlePrinterLoadedSpoolChange(printer, e.target.value || null)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">None</option>
                      {(stats.spoolsList ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.filamentType})
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <div className="printer-no-spool">
                    <span className="printer-no-spool-label">No spool loaded</span>
                    <select
                      className="printer-loaded-select"
                      value=""
                      onChange={(e) => handlePrinterLoadedSpoolChange(printer, e.target.value || null)}
                    >
                      <option value="">Select spool…</option>
                      {(stats.spoolsList ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.filamentType})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
