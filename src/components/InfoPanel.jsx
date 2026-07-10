import {
  formatPct,
  formatFloors,
  formatDateKey,
} from '../data/inflationMath.js';

/**
 * Card flutuante compacto ao clicar num prédio (não é sidebar).
 */
export default function InfoPanel({ building, mode, onClose }) {
  if (!building) return null;

  const { group, stats } = building;

  return (
    <div className="detail-card" role="dialog" aria-label={group.fullName}>
      <button type="button" className="detail-card__close" onClick={onClose} aria-label="Fechar">
        ×
      </button>
      <div className="detail-card__row">
        <span
          className="detail-card__dot"
          style={{ background: group.color, boxShadow: `0 0 12px ${group.color}` }}
        />
        <div>
          <div className="detail-card__name">{group.fullName}</div>
          <div className="detail-card__meta">
            {formatDateKey(stats.startDate)} → {formatDateKey(stats.endDate)}
            {mode === 'twelveMonths' ? ' · 12 meses' : ''}
          </div>
        </div>
      </div>
      <div className="detail-card__pct" style={{ color: group.color }}>
        {stats.noDataYet ? '—' : formatPct(stats.inflationPct)}
      </div>
      <div className="detail-card__stats">
        <span>{formatFloors(stats.floors)} andares</span>
        {stats.lastMonthly != null && (
          <span>últ. mês {formatPct(stats.lastMonthly)}</span>
        )}
      </div>
    </div>
  );
}
