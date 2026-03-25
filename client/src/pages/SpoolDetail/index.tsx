import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { spoolsApi, printJobsApi } from '@services/api';
import type { Spool, PrintJob, SpoolCreateRequest } from '@ha-addon/types';
import PrintJobCard from '@components/PrintJobCard';
import ProgressBar from '@components/ProgressBar';
import AddEditSpoolModal from '@modals/AddEditSpoolModal';
import DeductFilamentModal from '@modals/DeductFilamentModal';
import ConfirmModal from '@modals/ConfirmModal';
import './index.css';

export default function SpoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [spool, setSpool] = useState<Spool | null>(null);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [spoolRes, jobsRes] = await Promise.all([
          spoolsApi.getById(id),
          printJobsApi.getAll({ spoolId: id, limit: 100 }),
        ]);
        if (cancelled) return;
        setSpool(spoolRes.data);
        setJobs(jobsRes.data);
      } catch {
        if (!cancelled) setError('Failed to load spool');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [id]);

  if (loading && !spool) {
    return (
      <div className="spool-detail-page">
        <div className="loading-container"><div className="spinner" /><p>Loading...</p></div>
      </div>
    );
  }

  if (error || !spool) {
    return (
      <div className="spool-detail-page">
        <p className="spool-detail-error">{error || 'Spool not found'}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/spools')}>Back to Spools</button>
      </div>
    );
  }

  const handleSaveEdit = async (data: SpoolCreateRequest) => {
    if (!spool) return;
    try {
      const updated = await spoolsApi.update(spool.id, data);
      setSpool(updated.data);
      setShowEditModal(false);
    } catch (err) {
      console.error('Failed to update spool:', err);
    }
  };

  const handleDeduct = async (amount: number, _reason: string) => {
    if (!spool) return;
    try {
      const updated = await spoolsApi.deduct(spool.id, { amount });
      setSpool(updated.data);
      setShowDeductModal(false);
    } catch (err) {
      console.error('Failed to deduct filament:', err);
    }
  };

  const handleArchive = async () => {
    if (!spool) return;
    try {
      await spoolsApi.archive(spool.id);
      setConfirmArchive(false);
      navigate('/spools');
    } catch (err) {
      console.error('Failed to archive spool:', err);
    }
  };

  const colorDisplay = spool.colorHex || spool.color;

  return (
    <div className="spool-detail-page">
      <nav className="spool-detail-breadcrumb">
        <button type="button" className="breadcrumb-link" onClick={() => navigate('/spools')}>
          ← Spools
        </button>
      </nav>

      <div className="spool-detail-header">
        <span className="spool-detail-dot" style={{ backgroundColor: colorDisplay }} />
        <div className="spool-detail-info">
          <h1 className="spool-detail-name">{spool.name}</h1>
          <span className="spool-detail-meta">{spool.filamentType} · {Math.round(spool.remainingWeight)}g / {Math.round(spool.initialWeight)}g</span>
        </div>
        <div className="spool-detail-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowDeductModal(true)}>
            Deduct
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(true)}>
            Edit
          </button>
          {spool.archivedAt === null && (
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmArchive(true)}>
              Archive
            </button>
          )}
        </div>
      </div>

      <div className="spool-detail-progress">
        <ProgressBar value={spool.remainingWeight} max={spool.initialWeight} size="md" />
      </div>

      <section className="spool-detail-section">
        <h2 className="section-title">Print jobs</h2>
        {jobs.length === 0 ? (
          <p className="spool-detail-empty">No print jobs recorded for this spool yet.</p>
        ) : (
          <div className="spool-detail-jobs">
            {jobs.map((job) => (
              <PrintJobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>

      {showEditModal && spool && (
        <AddEditSpoolModal
          spool={spool}
          onSave={handleSaveEdit}
          onCancel={() => setShowEditModal(false)}
        />
      )}

      {showDeductModal && spool && (
        <DeductFilamentModal
          spool={spool}
          onConfirm={handleDeduct}
          onCancel={() => setShowDeductModal(false)}
        />
      )}

      {confirmArchive && spool && (
        <ConfirmModal
          title="Archive Spool"
          message={`Archive "${spool.name}"? It will be hidden from active lists but not deleted.`}
          confirmLabel="Archive"
          confirmVariant="danger"
          onConfirm={handleArchive}
          onCancel={() => setConfirmArchive(false)}
        />
      )}
    </div>
  );
}
