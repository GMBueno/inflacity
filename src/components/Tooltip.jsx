import { formatPct, formatFloors, formatDateKey } from '../data/inflationMath.js';

/**
 * Tooltip flutuante no hover (HTML overlay, não 3D).
 */
export default function Tooltip({ building, mode, x, y, visible }) {
  if (!visible || !building) return null;

  const { group, stats } = building;
  const modeShort =
    mode === 'twelveMonths' ? '12 meses' : 'acumulado';

  return (
    <div
      className="tooltip"
      style={{
        left: x,
        top: y,
      }}
    >
      <div className="tooltip__head">
        <span
          className="tooltip__dot"
          style={{ background: group.color }}
        />
        <strong>{group.fullName}</strong>
      </div>
      <div className="tooltip__pct" style={{ color: group.color }}>
        {formatPct(stats.inflationPct)}
      </div>
      <div className="tooltip__meta">
        {formatFloors(stats.floors)} andares · {modeShort}
        <br />
        {formatDateKey(stats.startDate)} → {formatDateKey(stats.endDate)}
        {stats.latestWeight != null && (
          <>
            <br />
            Peso: {stats.latestWeight.toLocaleString('pt-BR', {
              maximumFractionDigits: 2,
            })}
            %
          </>
        )}
      </div>
      <div className="tooltip__hint">Clique para detalhes</div>
    </div>
  );
}
