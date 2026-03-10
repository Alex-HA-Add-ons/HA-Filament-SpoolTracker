import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { printJobsApi, spoolsApi, printersApi } from '@services/api';
import type { PrintJob, Spool, Printer, PrintJobStatus } from '@ha-addon/types';
import PrintJobCard from '@components/PrintJobCard';
import AddPrintJobModal from '@modals/AddPrintJobModal';
import ConfirmModal from '@modals/ConfirmModal';
import './index.css';

const PAGE_SIZE = 20;

export default function PrintHistoryPage() {
  const location = useLocation();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [spools, setSpools] = useState<Spool[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [assigningJob, setAssigningJob] = useState<PrintJob | null>(null);
  const [selectedSpoolId, setSelectedSpoolId] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingJob, setDeletingJob] = useState<PrintJob | null>(null);

  // Initialize status filter from query string (e.g. /history?status=in_progress)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get('status');
    if (!raw) return;
    const allowed = ['', 'in_progress', 'completed', 'failed', 'cancelled'] as const;
    if (allowed.includes(raw as typeof allowed[number])) {
      setStatusFilter(raw);
    }
  }, [location.search]);

  const reloadFirstPage = useCallback(async () => {
    setJobs([]);
    setHasMore(true);
    setLoading(true);
    try {
      const res = await printJobsApi.getAll({ limit: PAGE_SIZE, offset: 0, ...(statusFilter && { status: statusFilter }) });
      setJobs(res.data);
      setHasMore(res.data.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    const params: Record<string, string | number> = { limit: PAGE_SIZE, offset };
    if (statusFilter) params.status = statusFilter;
    const response = await printJobsApi.getAll(params);
    const data = response.data;
    if (append) {
      setJobs((prev) => [...prev, ...data]);
    } else {
      setJobs(data);
    }
    setHasMore(data.length === PAGE_SIZE);
    return data;
  }, [statusFilter]);

  useEffect(() => {
    setJobs([]);
    setHasMore(true);
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string | number> = { limit: PAGE_SIZE, offset: 0 };
    if (statusFilter) params.status = statusFilter;
    printJobsApi.getAll(params)
      .then((res) => {
        if (!cancelled) {
          setJobs(res.data);
          setHasMore(res.data.length === PAGE_SIZE);
        }
      })
      .catch((err) => { if (!cancelled) console.error('Failed to fetch print jobs:', err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter]);

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    fetchPage(jobs.length, true)
      .catch((err) => console.error('Failed to fetch more print jobs:', err))
      .finally(() => setLoadingMore(false));
  }, [fetchPage, jobs.length]);

  useEffect(() => {
    spoolsApi.getAll().then((r) => setSpools(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (showAddModal) {
      printersApi.getAll().then((r) => setPrinters(r.data)).catch(() => {});
    }
  }, [showAddModal]);

  const handleAssignSpool = async () => {
    if (!assigningJob || !selectedSpoolId) return;
    try {
      await printJobsApi.update(assigningJob.id, { spoolId: selectedSpoolId });
      setAssigningJob(null);
      setSelectedSpoolId('');
      await reloadFirstPage();
    } catch (err) {
      console.error('Failed to assign spool:', err);
    }
  };

  const handleAddPrint = async (data: {
    projectName: string;
    printerId?: string | null;
    spoolId?: string | null;
    filamentUsed?: number | null;
    status: PrintJobStatus;
    notes?: string | null;
  }) => {
    try {
      await printJobsApi.create(data);
      setShowAddModal(false);
      await reloadFirstPage();
    } catch (err) {
      console.error('Failed to add print job:', err);
    }
  };

  const handleDeleteJob = async () => {
    if (!deletingJob) return;
    try {
      await printJobsApi.delete(deletingJob.id);
      setJobs((prev) => prev.filter((j) => j.id !== deletingJob.id));
      setDeletingJob(null);
    } catch (err) {
      console.error('Failed to delete print job:', err);
    }
  };

  const handleCompleteJob = async (job: PrintJob) => {
    try {
      await printJobsApi.update(job.id, { status: 'completed' });
      await reloadFirstPage();
    } catch (err) {
      console.error('Failed to complete print job:', err);
    }
  };

  const statuses = ['', 'in_progress', 'completed', 'failed', 'cancelled'];
  const statusLabels: Record<string, string> = {
    '': 'All',
    in_progress: 'In Progress',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };

  return (
    <div className="print-history-page">
      <div className="page-header page-header-with-action">
        <div>
          <h2 className="page-title">Print History</h2>
          <p className="page-subtitle">View and manage print jobs logged from your Bambu Lab printers</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
          Add print manually
        </button>
      </div>

      <div className="history-filters">
        {statuses.map((s) => (
          <button
            key={s}
            className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setStatusFilter(s)}
          >
            {statusLabels[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /><p>Loading print jobs...</p></div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <h3>No prints recorded yet</h3>
          <p>Print jobs appear here when detected from Bambu Lab via Home Assistant, or use <strong>Add print manually</strong> when HA is not connected.</p>
        </div>
      ) : (
        <>
          <div className="print-jobs-list">
            {jobs.map((job) => (
              <PrintJobCard
                key={job.id}
                job={job}
                onAssignSpool={(j) => { setAssigningJob(j); setSelectedSpoolId(''); }}
                onComplete={handleCompleteJob}
                onDelete={(j) => setDeletingJob(j)}
              />
            ))}
          </div>
          {hasMore && (
            <div className="load-more-row">
              <button
                className="btn btn-secondary"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {showAddModal && (
        <AddPrintJobModal
          printers={printers}
          spools={spools}
          onSave={handleAddPrint}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {assigningJob && (
        <div className="modal-overlay" onClick={() => setAssigningJob(null)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Assign Spool</h3>
            <p className="modal-subtitle">
              Select a spool for <strong>{assigningJob.projectName}</strong>
              {assigningJob.filamentUsed != null && ` (${Math.round(assigningJob.filamentUsed)}g used)`}
            </p>
            <div className="form-group">
              <label>Spool</label>
              <select value={selectedSpoolId} onChange={(e) => setSelectedSpoolId(e.target.value)}>
                <option value="">Select a spool...</option>
                {spools.filter((s) => !s.isArchived).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.filamentType}, {Math.round(s.remainingWeight)}g left)
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setAssigningJob(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAssignSpool} disabled={!selectedSpoolId}>
                Assign & Deduct
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingJob && (
        <ConfirmModal
          title="Delete print job"
          message={`Delete "${deletingJob.projectName}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteJob}
          onCancel={() => setDeletingJob(null)}
        />
      )}
    </div>
  );
}
