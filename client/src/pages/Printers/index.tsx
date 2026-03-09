import { useState, useEffect } from 'react';
import { printersApi, haApi, spoolsApi } from '@services/api';
import type { Printer, Spool, HAConnectionStatus, HADiscoveredEntity } from '@ha-addon/types';
import EditPrinterModal, { type EditPrinterSaveData } from '@modals/EditPrinterModal';
import AddPrinterModal from '@modals/AddPrinterModal';
import ConfirmModal from '@modals/ConfirmModal';
import './index.css';

export default function PrintersPage() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [haStatus, setHaStatus] = useState<HAConnectionStatus | null>(null);
  const [discoveredEntities, setDiscoveredEntities] = useState<HADiscoveredEntity[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [deletingPrinter, setDeletingPrinter] = useState<Printer | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [spools, setSpools] = useState<Spool[]>([]);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [printersRes, haStatusRes, spoolsRes] = await Promise.all([
          printersApi.getAll(),
          haApi.getStatus(),
          spoolsApi.getAll(),
        ]);
        setPrinters(printersRes.data);
        setHaStatus(haStatusRes.data);
        setSpools(spoolsRes.data);
      } catch (err) {
        console.error('Failed to load printers:', err);
      }
    };
    loadAll();
  }, []);

  const handleDiscoverEntities = async () => {
    setDiscovering(true);
    try {
      const response = await haApi.getEntities();
      setDiscoveredEntities(response.data);
    } catch (err) {
      console.error('Failed to discover entities:', err);
    } finally {
      setDiscovering(false);
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

  const handleAddPrinter = async (data: { name: string; entityPrefix: string; model?: string }) => {
    try {
      const prefix = data.entityPrefix.trim();
      await printersApi.create({
        name: data.name.trim() || prefix.replace(/_/g, ' '),
        haDeviceId: prefix,
        entityPrefix: prefix,
        model: data.model,
      });
      const res = await printersApi.getAll();
      setPrinters(res.data);
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add printer:', err);
    }
  };

  const handleSaveEdit = async (data: EditPrinterSaveData) => {
    if (!editingPrinter) return;
    try {
      const res = await printersApi.update(editingPrinter.id, data);
      setPrinters((prev) => prev.map((p) => (p.id === editingPrinter.id ? res.data : p)));
      setEditingPrinter(null);
    } catch (err) {
      console.error('Failed to update printer:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPrinter) return;
    try {
      await printersApi.delete(deletingPrinter.id);
      setPrinters((prev) => prev.filter((p) => p.id !== deletingPrinter.id));
      setDeletingPrinter(null);
    } catch (err) {
      console.error('Failed to delete printer:', err);
    }
  };

  const unregistered = discoveredEntities.filter(
    (e) => !printers.some((p) => p.haDeviceId === e.deviceId)
  );

  return (
    <div className="printers-page">
      <h2 className="page-title">Printers</h2>
      <p className="page-subtitle">Manage your Bambu Lab printers connected to Home Assistant</p>

      <div className="printers-section">
        <div className="ha-connection-bar">
          <span className={`ha-dot ${haStatus?.connected ? 'connected' : 'disconnected'}`} />
          <span>{haStatus?.connected ? 'Connected to Home Assistant' : 'Not connected'}</span>
          {haStatus?.connected && (
            <span className="ha-detected">{haStatus.printerCount} printer(s) detected</span>
          )}
          <div className="ha-connection-bar-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(true)}>
              Add printer manually
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleDiscoverEntities} disabled={discovering}>
              {discovering ? 'Discovering...' : 'Discover Printers'}
            </button>
          </div>
        </div>
      </div>

      {printers.length > 0 && (
        <div className="printers-section">
          <h3 className="section-title">Registered Printers</h3>
          <div className="printer-cards">
            {printers.map((printer) => (
              <div key={printer.id} className="printer-card">
                <div className="printer-card-icon">🖨️</div>
                <div className="printer-card-info">
                  <span className="printer-card-name">{printer.name}</span>
                  <span className="printer-card-model">{printer.model || 'Unknown model'}</span>
                  <span className="printer-card-entity">{printer.entityPrefix}</span>
                </div>
                <div className="printer-card-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingPrinter(printer)}>
                    Edit
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeletingPrinter(printer)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unregistered.length > 0 && (
        <div className="printers-section">
          <h3 className="section-title">Available to Register</h3>
          <div className="printer-cards">
            {unregistered.map((entity) => (
              <div key={entity.deviceId} className="printer-card printer-card-discovered">
                <div className="printer-card-icon">🔍</div>
                <div className="printer-card-info">
                  <span className="printer-card-name">{entity.deviceName}</span>
                  <span className="printer-card-model">{entity.model || 'Bambu Lab'}</span>
                  <span className="printer-card-entity">{entity.entities.length} entities</span>
                </div>
                <div className="printer-card-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => handleRegisterPrinter(entity)}>
                    Register
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {printers.length === 0 && unregistered.length === 0 && (
        <div className="printers-empty">
          <p>No printers yet. Use <strong>Discover Printers</strong> when HA is connected, or <strong>Add printer manually</strong> for dev or when HA is not available.</p>
        </div>
      )}

      {showAddModal && (
        <AddPrinterModal
          onSave={handleAddPrinter}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editingPrinter && (
        <EditPrinterModal
          printer={editingPrinter}
          spools={spools}
          onSave={handleSaveEdit}
          onClose={() => setEditingPrinter(null)}
          onDiscover={async () => {
            const res = await haApi.getEntities();
            return res.data;
          }}
          onFetchEntityStates={(ids) => haApi.getEntityStates(ids).then((r) => r.data)}
        />
      )}

      {deletingPrinter && (
        <ConfirmModal
          title="Remove Printer"
          message={`Remove "${deletingPrinter.name}"? Print jobs linked to this printer will keep their history but won't be associated with a printer anymore.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingPrinter(null)}
        />
      )}
    </div>
  );
}
