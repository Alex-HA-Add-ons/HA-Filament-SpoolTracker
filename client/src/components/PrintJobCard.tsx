import type { PrintJob } from '@ha-addon/types';
import StatusBadge from './StatusBadge';
import './PrintJobCard.css';

interface PrintJobCardProps {
  job: PrintJob;
  onAssignSpool?: (job: PrintJob) => void;
}

export default function PrintJobCard({ job, onAssignSpool }: PrintJobCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="print-job-card">
      <div className="print-job-left">
        {job.projectImage ? (
          <img src={job.projectImage} alt={job.projectName} className="print-job-thumb" />
        ) : (
          <div className="print-job-thumb-placeholder" />
        )}
      </div>
      <div className="print-job-info">
        <div className="print-job-header">
          <h4 className="print-job-name">{job.projectName}</h4>
          <StatusBadge status={job.status} />
        </div>
        <div className="print-job-meta">
          {job.printer && <span className="meta-item">Printer: {job.printer.name}</span>}
          {job.spool ? (
            <span className="meta-item">
              <span className="spool-dot" style={{ backgroundColor: job.spool.colorHex || job.spool.color }} />
              {job.spool.name}
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
