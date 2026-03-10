import { Link } from 'react-router-dom';
import type { PrintJob } from '@ha-addon/types';
import { getApiBaseURL } from '../services/api';
import StatusBadge from './StatusBadge';
import './PrintJobCard.css';

function projectImageSrc(projectImage: string | null): string | undefined {
  if (!projectImage) return undefined;
  if (projectImage.startsWith('http://') || projectImage.startsWith('https://')) return projectImage;
  const base = getApiBaseURL();
  return base.endsWith('/') ? base + projectImage.replace(/^\//, '') : base + (projectImage.startsWith('/') ? projectImage : '/' + projectImage);
}

interface PrintJobCardProps {
  job: PrintJob;
  onAssignSpool?: (job: PrintJob) => void;
  onDelete?: (job: PrintJob) => void;
  onComplete?: (job: PrintJob) => void;
}

export default function PrintJobCard({ job, onAssignSpool, onDelete, onComplete }: PrintJobCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="print-job-card">
      <div className="print-job-left">
        {job.projectImage ? (
          <img src={projectImageSrc(job.projectImage)} alt={job.projectName} className="print-job-thumb" />
        ) : (
          <div className="print-job-thumb-placeholder" />
        )}
      </div>
      <div className="print-job-info">
        <div className="print-job-header">
          <h4 className="print-job-name">{job.projectName}</h4>
          <div className="print-job-header-actions">
            <StatusBadge status={job.status} />
            {onComplete && job.status === 'in_progress' && (
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => onComplete(job)}
                title="Mark print as completed"
              >
                Mark completed
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="print-job-delete-btn"
                onClick={() => onDelete(job)}
                title="Delete print job"
                aria-label="Delete print job"
              >
                Delete
              </button>
            )}
          </div>
        </div>
        <div className="print-job-meta">
          {job.printer && <span className="meta-item">Printer: {job.printer.name}</span>}
          {job.spool ? (
            <span className="meta-item">
              <span className="spool-dot" style={{ backgroundColor: job.spool.colorHex || job.spool.color }} />
              <Link to={`/spools/${job.spool.id}`} className="print-job-spool-link">
                {job.spool.name}
              </Link>
            </span>
          ) : (
            job.status === 'completed' && onAssignSpool && (
              <button className="btn btn-secondary btn-sm" onClick={() => onAssignSpool(job)}>
                Assign Spool
              </button>
            )
          )}
          {job.filamentUsed != null && (
            <span className="meta-item">{Math.round(job.filamentUsed)}g used</span>
          )}
          <span className="meta-item meta-date">{formatDate(job.startedAt)}</span>
        </div>
      </div>
    </div>
  );
}
