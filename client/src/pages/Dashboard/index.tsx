import { useState, useEffect } from 'react';
import { healthApi } from '@services/api';
import { useWebSocket } from '@hooks/useWebSocket';
import './index.css';

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  database: { connected: boolean };
}

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { connectionStatus } = useWebSocket();

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await healthApi.getHealth();
        setHealth(response.data);
        setError(null);
      } catch (_err) {
        setError('Failed to fetch health status');
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="dashboard">
      <h2 className="dashboard-title">Dashboard</h2>
      <p className="dashboard-subtitle">Welcome to your Home Assistant Add-on</p>

      <div className="status-grid">
        <div className="status-card">
          <div className="status-card-header">Server</div>
          <div className="status-card-body">
            {error ? (
              <span className="status-value error">Unreachable</span>
            ) : health ? (
              <>
                <span className="status-value success">Healthy</span>
                <span className="status-detail">Uptime: {formatUptime(health.uptime)}</span>
              </>
            ) : (
              <span className="status-value">Loading...</span>
            )}
          </div>
        </div>

        <div className="status-card">
          <div className="status-card-header">Database</div>
          <div className="status-card-body">
            {health ? (
              health.database.connected ? (
                <span className="status-value success">Connected</span>
              ) : (
                <>
                  <span className="status-value neutral">Not configured</span>
                  <span className="status-detail">Set DATABASE_URL to enable</span>
                </>
              )
            ) : (
              <span className="status-value">Loading...</span>
            )}
          </div>
        </div>

        <div className="status-card">
          <div className="status-card-header">WebSocket</div>
          <div className="status-card-body">
            <span className={`status-value ${connectionStatus === 'connected' ? 'success' : connectionStatus === 'error' ? 'error' : ''}`}>
              {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="info-card">
        <h3>Getting Started</h3>
        <p>
          This is a boilerplate Home Assistant add-on with a full-stack TypeScript architecture.
          Edit the source code to build your own add-on.
        </p>
        <ul>
          <li><strong>Server:</strong> Express + TypeScript + Prisma ORM + WebSocket</li>
          <li><strong>Client:</strong> React + TypeScript + Vite</li>
          <li><strong>Database:</strong> SQLite (default) or PostgreSQL (optional)</li>
          <li><strong>Infrastructure:</strong> pnpm workspaces, Docker, HA ingress</li>
        </ul>
      </div>
    </div>
  );
}
