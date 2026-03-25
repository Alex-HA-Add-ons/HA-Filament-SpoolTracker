import { useState } from 'react';
import type { Printer, Spool } from '@ha-addon/types';
import type { PrintJobStatus } from '@ha-addon/types';
import './Modal.css';

interface AddPrintJobModalProps {
  printers: Printer[];
  spools: Spool[];
  onSave: (data: {
    projectName: string;
    printerId?: string | null;
    spoolId?: string | null;
    filamentUsed?: number | null;
    status: PrintJobStatus;
    notes?: string | null;
  }) => void;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: PrintJobStatus; label: string }[] = [
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function AddPrintJobModal({ printers, spools, onSave, onClose }: AddPrintJobModalProps) {
  const [projectName, setProjectName] = useState('');
  const [printerId, setPrinterId] = useState('');
  const [spoolId, setSpoolId] = useState('');
  const [filamentUsed, setFilamentUsed] = useState('');
  const [status, setStatus] = useState<PrintJobStatus>('completed');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    const used = filamentUsed === '' ? null : parseFloat(filamentUsed);
    onSave({
      projectName: name,
      printerId: printerId || null,
      spoolId: spoolId || null,
      filamentUsed: used != null && Number.isFinite(used) ? used : null,
      status,
      notes: notes.trim() || null,
    });
  };

  const activeSpools = spools.filter((s) => s.archivedAt === null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Print Job</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <p className="modal-hint">
          Use this when HA is not connected or a print wasn’t detected. If you set status to Completed and choose a spool + filament used, the spool will be deducted.
        </p>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Project / model name *</label>
            <input
              required
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Benchy"
            />
          </div>
          <div className="form-group">
            <label>Printer</label>
            <select value={printerId} onChange={(e) => setPrinterId(e.target.value)}>
              <option value="">None</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Spool</label>
            <select value={spoolId} onChange={(e) => setSpoolId(e.target.value)}>
              <option value="">None</option>
              {activeSpools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.filamentType}, {Math.round(s.remainingWeight)}g left)
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Filament used (g)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={filamentUsed}
              onChange={(e) => setFilamentUsed(e.target.value)}
              placeholder="e.g., 12.5"
            />
            {status === 'completed' && spoolId && (
              <span className="form-hint">Will deduct this amount from the selected spool.</span>
            )}
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as PrintJobStatus)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add print</button>
          </div>
        </form>
      </div>
    </div>
  );
}
