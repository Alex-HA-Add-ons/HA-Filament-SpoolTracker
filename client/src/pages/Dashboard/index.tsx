import { useState, useEffect } from 'react';
import { dashboardApi } from '@services/api';
import type { DashboardStats } from '@ha-addon/types';
import PrintJobCard from '@components/PrintJobCard';
import ProgressBar from '@components/ProgressBar';
import './index.css';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await dashboardApi.getStats();
        setStats(response.data);
        setError(null);
      } catch {
        setError('Failed to load dashboard data');
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

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
          <span className="stat-value">{stats.totalSpools}</span>
          <span className="stat-label">Total Spools</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{(stats.totalFilamentStock / 1000).toFixed(1)}kg</span>
          <span className="stat-label">Filament Stock</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.activePrintJobs}</span>
          <span className="stat-label">Active Prints</span>
        </div>
        <div className={`stat-card ${stats.lowFilamentAlerts > 0 ? 'stat-warning' : ''}`}>
          <span className="stat-value">{stats.lowFilamentAlerts}</span>
          <span className="stat-label">Low Filament Alerts</span>
        </div>
      </div>

      {stats.lowFilamentSpools.length > 0 && (
        <div className="dashboard-section">
          <h3 className="section-title">Low Filament Warnings</h3>
          <div className="low-filament-list">
            {stats.lowFilamentSpools.map((spool) => (
              <div key={spool.id} className="low-filament-item">
                <div className="low-filament-info">
                  <span className="spool-dot-inline" style={{ backgroundColor: spool.colorHex || spool.color }} />
                  <span className="low-filament-name">{spool.name}</span>
                  <span className="low-filament-type">{spool.filamentType}</span>
                </div>
                <div className="low-filament-bar">
                  <ProgressBar value={spool.remainingWeight} max={spool.initialWeight} size="sm" />
                  <span className="low-filament-weight">{Math.round(spool.remainingWeight)}g</span>
                </div>
              </div>
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
