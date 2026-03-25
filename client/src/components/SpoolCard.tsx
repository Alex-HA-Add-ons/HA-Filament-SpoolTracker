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
  onNameClick?: (spool: Spool) => void;
}

export default function SpoolCard({ spool, onEdit, onDeduct, onArchive, onDelete, onActivate, onNameClick }: SpoolCardProps) {
  const colorDisplay = spool.colorHex || spool.color;
  const isLow = spool.remainingWeight <= 100;
  const isActive = spool.isActive || !!spool.loadedOnPrinter;

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  const archivedAtDisplay = spool.archivedAt ? formatDateTime(spool.archivedAt) : null;

  return (
    <div className={`spool-card ${isActive ? 'active' : ''} ${isLow ? 'low' : ''}`}>
      <div className="spool-card-header">
        <div className="spool-color" style={{ backgroundColor: colorDisplay }} />
        <div className="spool-info">
          {onNameClick ? (
            <button type="button" className="spool-name spool-name-btn" onClick={() => onNameClick(spool)} title="View prints">
              {spool.name}
            </button>
          ) : (
            <h3 className="spool-name">{spool.name}</h3>
          )}
          <span className="spool-type-badge">{spool.filamentType}</span>
        </div>
        {archivedAtDisplay ? (
          <span className="spool-archived-badge" title={`Archived ${archivedAtDisplay}`}>
            {archivedAtDisplay}
          </span>
        ) : isActive ? (
          <span className="spool-active-badge" title={spool.loadedOnPrinter ? `Loaded on ${spool.loadedOnPrinter.name}` : undefined}>
            {spool.loadedOnPrinter ? `On ${spool.loadedOnPrinter.name}` : 'Active'}
          </span>
        ) : null}
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
        <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => onEdit(spool)} title="Edit" aria-label="Edit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          <span className="btn-icon-label">Edit</span>
        </button>
        <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => onDeduct(spool)} title="Deduct filament" aria-label="Deduct filament">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
          <span className="btn-icon-label">Deduct</span>
        </button>
        {!isActive ? (
          <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => onActivate(spool)} title="Activate (mark as in use)" aria-label="Activate">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            <span className="btn-icon-label">Activate</span>
          </button>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => onArchive(spool)} title="Archive spool" aria-label="Archive">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>
            <span className="btn-icon-label">Archive</span>
          </button>
        )}
        <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => onDelete(spool)} title="Delete" aria-label="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          <span className="btn-icon-label">Delete</span>
        </button>
      </div>
    </div>
  );
}
