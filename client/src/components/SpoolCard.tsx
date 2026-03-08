import type { Spool } from '@ha-addon/types';
import ProgressBar from './ProgressBar';
import './SpoolCard.css';

interface SpoolCardProps {
  spool: Spool;
  onEdit: (spool: Spool) => void;
  onDeduct: (spool: Spool) => void;
  onArchive: (spool: Spool) => void;
  onDelete: (spool: Spool) => void;
  onActivate: (spool: Spool) => void;
}

export default function SpoolCard({ spool, onEdit, onDeduct, onArchive, onDelete, onActivate }: SpoolCardProps) {
  const colorDisplay = spool.colorHex || spool.color;
  const isLow = spool.remainingWeight <= 100;

  return (
    <div className={`spool-card ${spool.isActive ? 'active' : ''} ${isLow ? 'low' : ''}`}>
      <div className="spool-card-header">
        <div className="spool-color" style={{ backgroundColor: colorDisplay }} />
        <div className="spool-info">
          <h3 className="spool-name">{spool.name}</h3>
          <span className="spool-type-badge">{spool.filamentType}</span>
        </div>
        {spool.isActive && <span className="spool-active-badge">Active</span>}
      </div>

      <div className="spool-card-body">
        <div className="spool-weight">
          <span className="weight-value">{Math.round(spool.remainingWeight)}g</span>
          <span className="weight-separator"> / </span>
          <span className="weight-total">{Math.round(spool.initialWeight)}g</span>
        </div>
        <ProgressBar value={spool.remainingWeight} max={spool.initialWeight} size="sm" />
        {spool.manufacturer && (
          <span className="spool-manufacturer">{spool.manufacturer}</span>
        )}
      </div>

      <div className="spool-card-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => onEdit(spool)}>Edit</button>
        <button className="btn btn-secondary btn-sm" onClick={() => onDeduct(spool)}>Deduct</button>
        {!spool.isActive ? (
          <button className="btn btn-secondary btn-sm" onClick={() => onActivate(spool)}>Activate</button>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={() => onArchive(spool)}>Archive</button>
        )}
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(spool)}>Delete</button>
      </div>
    </div>
  );
}
