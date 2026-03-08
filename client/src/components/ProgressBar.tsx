import './ProgressBar.css';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showPercent?: boolean;
  size?: 'sm' | 'md';
}

export default function ProgressBar({ value, max, label, showPercent = true, size = 'md' }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  const getColor = () => {
    if (percent <= 10) return 'var(--error-color)';
    if (percent <= 25) return 'var(--warning-color)';
    return 'var(--accent-primary)';
  };

  return (
    <div className={`progress-bar-container ${size}`}>
      {label && <span className="progress-bar-label">{label}</span>}
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${percent}%`, backgroundColor: getColor() }}
        />
      </div>
      {showPercent && <span className="progress-bar-value">{Math.round(percent)}%</span>}
    </div>
  );
}
