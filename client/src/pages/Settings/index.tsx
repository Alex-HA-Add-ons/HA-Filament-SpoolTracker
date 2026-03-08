import { useState, useEffect } from 'react';
import { settingsApi, printersApi, haApi } from '@services/api';
import type { Printer, HAConnectionStatus, HADiscoveredEntity } from '@ha-addon/types';
import './index.css';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [haStatus, setHaStatus] = useState<HAConnectionStatus | null>(null);
  const [discoveredEntities, setDiscoveredEntities] = useState<HADiscoveredEntity[]>([]);
  const [lowThreshold, setLowThreshold] = useState('100');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [settingsRes, printersRes, haStatusRes] = await Promise.all([
          settingsApi.getAll(),
          printersApi.getAll(),
          haApi.getStatus(),
        ]);
        setSettings(settingsRes.data);
        setPrinters(printersRes.data);
        setHaStatus(haStatusRes.data);
        setLowThreshold(settingsRes.data['low_filament_threshold'] || '100');
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    loadAll();
  }, []);

  const handleDiscoverEntities = async () => {
    try {
      const response = await haApi.getEntities();
      setDiscoveredEntities(response.data);
    } catch (err) {
      console.error('Failed to discover entities:', err);
    }
  };

  const handleRegisterPrinter = async (entity: HADiscoveredEntity) => {
    try {
      await printersApi.create({
        name: entity.deviceName,
        haDeviceId: entity.deviceId,
        entityPrefix: entity.deviceId,
        model: entity.model || undefined,
      });
      const res = await printersApi.getAll();
      setPrinters(res.data);
    } catch (err) {
      console.error('Failed to register printer:', err);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.update({
        low_filament_threshold: lowThreshold,
      });
      setSettings(res.data);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrinter = async (id: string) => {
    try {
      await printersApi.delete(id);
      setPrinters((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete printer:', err);
    }
  };

  return (
    <div className="settings-page">
      <h2 className="page-title">Settings</h2>
      <p className="page-subtitle">Configure printers, notifications, and preferences</p>

      <div className="settings-section">
        <h3 className="section-title">Home Assistant Connection</h3>
        <div className="settings-card">
          <div className="ha-status-row">
            <span className={`ha-status-indicator ${haStatus?.connected ? 'connected' : 'disconnected'}`} />
            <span>{haStatus?.connected ? 'Connected to Home Assistant' : 'Not connected'}</span>
            {haStatus?.connected && (
              <span className="ha-printer-count">{haStatus.printerCount} Bambu printer(s) detected</span>
            )}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="section-header">
          <h3 className="section-title">Printers</h3>
          <button className="btn btn-secondary btn-sm" onClick={handleDiscoverEntities}>
            Discover Printers
          </button>
        </div>

        {printers.length > 0 && (
          <div className="printers-list">
            {printers.map((printer) => (
              <div key={printer.id} className="printer-item">
                <div className="printer-info">
                  <span className="printer-name">{printer.name}</span>
                  <span className="printer-model">{printer.model || 'Unknown model'}</span>
                  <span className="printer-prefix">{printer.entityPrefix}</span>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeletePrinter(printer.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {discoveredEntities.length > 0 && (
          <div className="discovered-entities">
            <h4>Discovered Bambu Lab Printers</h4>
            {discoveredEntities
              .filter((e) => !printers.some((p) => p.haDeviceId === e.deviceId))
              .map((entity) => (
                <div key={entity.deviceId} className="discovered-item">
                  <div className="discovered-info">
                    <span className="discovered-name">{entity.deviceName}</span>
                    <span className="discovered-count">{entity.entities.length} entities</span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => handleRegisterPrinter(entity)}>
                    Register
                  </button>
                </div>
              ))}
          </div>
        )}

        {printers.length === 0 && discoveredEntities.length === 0 && (
          <p className="settings-hint">Click "Discover Printers" to find Bambu Lab printers from your Home Assistant instance.</p>
        )}
      </div>

      <div className="settings-section">
        <h3 className="section-title">Notifications</h3>
        <div className="settings-card">
          <div className="form-group">
            <label>Low Filament Threshold (grams)</label>
            <input
              type="number"
              value={lowThreshold}
              onChange={(e) => setLowThreshold(e.target.value)}
              min="0"
              max="5000"
              style={{ maxWidth: 200 }}
            />
            <span className="form-hint">
              Get notified when a spool drops below this weight. Currently: {settings['low_filament_threshold'] || '100'}g
            </span>
          </div>
          <button className="btn btn-primary" onClick={handleSaveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
