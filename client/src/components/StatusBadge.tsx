import './StatusBadge.css';
import type { PrintJobStatus } from '@ha-addon/types';

interface StatusBadgeProps {
  status: PrintJobStatus | string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  in_progress: { label: 'In Progress', className: 'badge-info' },
  completed: { label: 'Completed', className: 'badge-success' },
  failed: { label: 'Failed', className: 'badge-danger' },
  cancelled: { label: 'Cancelled', className: 'badge-muted' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'badge-muted' };

  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
}
