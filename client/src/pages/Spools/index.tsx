import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { spoolsApi } from '@services/api';
import type { Spool, SpoolCreateRequest } from '@ha-addon/types';
import SpoolCard from '@components/SpoolCard';
import AddEditSpoolModal from '@modals/AddEditSpoolModal';
import DeductFilamentModal from '@modals/DeductFilamentModal';
import ConfirmModal from '@modals/ConfirmModal';
import './index.css';

type SpoolFilter = 'all' | 'active' | 'archived' | 'low';

const LOW_FILAMENT_THRESHOLD = 100; // grams — keep in sync with server/dashboard

export default function SpoolsPage() {
  const [spools, setSpools] = useState<Spool[]>([]);
  const [filter, setFilter] = useState<SpoolFilter>('all');
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSpool, setEditingSpool] = useState<Spool | null>(null);
  const [deductingSpool, setDeductingSpool] = useState<Spool | null>(null);
  const [deletingSpool, setDeletingSpool] = useState<Spool | null>(null);

  const fetchSpools = useCallback(async () => {
    try {
      const status = filter === 'all' || filter === 'low' ? undefined : filter;
      const response = await spoolsApi.getAll(status);
      const allSpools = response.data;
      if (filter === 'low') {
        setSpools(allSpools.filter((s) => !s.isArchived && s.remainingWeight <= LOW_FILAMENT_THRESHOLD));
      } else {
        setSpools(allSpools);
      }
    } catch (err) {
      console.error('Failed to fetch spools:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchSpools();
  }, [fetchSpools]);

  // Initialize filter from query string (e.g. /spools?filter=active)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get('filter');
    if (!raw) return;
    const value = raw.toLowerCase() as SpoolFilter;
    if (value === 'all' || value === 'active' || value === 'archived' || value === 'low') {
      setFilter(value);
    }
  }, [location.search]);

  const handleSave = async (data: SpoolCreateRequest) => {
    try {
      if (editingSpool) {
        await spoolsApi.update(editingSpool.id, data);
      } else {
        await spoolsApi.create(data);
      }
      setShowAddModal(false);
      setEditingSpool(null);
      fetchSpools();
    } catch (err) {
      console.error('Failed to save spool:', err);
    }
  };

  const handleDeduct = async (amount: number, _reason: string) => {
    if (!deductingSpool) return;
    try {
      await spoolsApi.deduct(deductingSpool.id, { amount });
      setDeductingSpool(null);
      fetchSpools();
    } catch (err) {
      console.error('Failed to deduct filament:', err);
    }
  };

  const handleDelete = async () => {
    if (!deletingSpool) return;
    try {
      await spoolsApi.delete(deletingSpool.id);
      setDeletingSpool(null);
      fetchSpools();
    } catch (err) {
      console.error('Failed to delete spool:', err);
    }
  };

  const handleArchive = async (spool: Spool) => {
    try {
      await spoolsApi.archive(spool.id);
      fetchSpools();
    } catch (err) {
      console.error('Failed to archive spool:', err);
    }
  };

  const handleActivate = async (spool: Spool) => {
    try {
      await spoolsApi.activate(spool.id);
      fetchSpools();
    } catch (err) {
      console.error('Failed to activate spool:', err);
    }
  };

  return (
    <div className="spools-page">
      <div className="spools-header">
        <div>
          <h2 className="page-title">Spools</h2>
          <p className="page-subtitle">Manage your filament spools</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + Add Spool
        </button>
      </div>

      <div className="spools-filters">
        {(['all', 'active', 'archived', 'low'] as SpoolFilter[]).map((f) => (
          <button
            key={f}
            className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setFilter(f)}
          >
            {f === 'low' ? 'Low' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /><p>Loading spools...</p></div>
      ) : spools.length === 0 ? (
        <div className="empty-state">
          <h3>No spools yet</h3>
          <p>Add your first filament spool to start tracking usage.</p>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Your First Spool</button>
        </div>
      ) : (
        <div className="spools-grid">
          {spools.map((spool) => (
            <SpoolCard
              key={spool.id}
              spool={spool}
              onEdit={(s) => setEditingSpool(s)}
              onDeduct={(s) => setDeductingSpool(s)}
              onArchive={handleArchive}
              onDelete={(s) => setDeletingSpool(s)}
              onActivate={handleActivate}
              onNameClick={(s) => navigate(`/spools/${s.id}`)}
            />
          ))}
        </div>
      )}

      {(showAddModal || editingSpool) && (
        <AddEditSpoolModal
          spool={editingSpool}
          onSave={handleSave}
          onCancel={() => { setShowAddModal(false); setEditingSpool(null); }}
        />
      )}

      {deductingSpool && (
        <DeductFilamentModal
          spool={deductingSpool}
          onConfirm={handleDeduct}
          onCancel={() => setDeductingSpool(null)}
        />
      )}

      {deletingSpool && (
        <ConfirmModal
          title="Delete Spool"
          message={`Are you sure you want to delete "${deletingSpool.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeletingSpool(null)}
        />
      )}
    </div>
  );
}
