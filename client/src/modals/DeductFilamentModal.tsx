import { useState } from 'react';
import type { Spool } from '@ha-addon/types';
import './Modal.css';

interface DeductFilamentModalProps {
  spool: Spool;
  onConfirm: (amount: number, reason: string) => void;
  onCancel: () => void;
}

export default function DeductFilamentModal({ spool, onConfirm, onCancel }: DeductFilamentModalProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) return;
    onConfirm(value, reason);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Deduct Filament</h3>
        <p className="modal-subtitle">
          Deduct from <strong>{spool.name}</strong> ({Math.round(spool.remainingWeight)}g remaining)
        </p>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Amount (grams)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0.1"
              max={spool.remainingWeight}
              step="0.1"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Failed print, calibration..."
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!amount || parseFloat(amount) <= 0}>
              Deduct
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
