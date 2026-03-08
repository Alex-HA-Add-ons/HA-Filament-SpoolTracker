import { useState, useEffect, useCallback } from 'react';
import { printJobsApi, spoolsApi } from '@services/api';
import type { PrintJob, Spool } from '@ha-addon/types';
import PrintJobCard from '@components/PrintJobCard';
import './index.css';

export default function PrintHistoryPage() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [spools, setSpools] = useState<Spool[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigningJob, setAssigningJob] = useState<PrintJob | null>(null);
  const [selectedSpoolId, setSelectedSpoolId] = useState('');

  const fetchJobs = useCallback(async () => {
    try {
      const params: Record<string, string | number> = {};
      if (statusFilter) params.status = statusFilter;
      const response = await printJobsApi.getAll(params);
      setJobs(response.data);
    } catch (err) {
      console.error('Failed to fetch print jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    spoolsApi.getAll().then((r) => setSpools(r.data)).catch(() => {});
  }, []);

  const handleAssignSpool = async () => {
    if (!assigningJob || !selectedSpoolId) return;
    try {
      await printJobsApi.update(assigningJob.id, { spoolId: selectedSpoolId });
      setAssigningJob(null);
      setSelectedSpoolId('');
      fetchJobs();
    } catch (err) {
      console.error('Failed to assign spool:', err);
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
      <div className="page-header">
        <h2 className="page-title">Print History</h2>
        <p className="page-subtitle">View and manage print jobs logged from your Bambu Lab printers</p>
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
          <p>Print jobs will appear here automatically when detected from your Bambu Lab printers via Home Assistant.</p>
        </div>
      ) : (
        <div className="print-jobs-list">
          {jobs.map((job) => (
            <PrintJobCard
              key={job.id}
              job={job}
              onAssignSpool={(j) => { setAssigningJob(j); setSelectedSpoolId(''); }}
            />
          ))}
        </div>
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
    </div>
  );
}
