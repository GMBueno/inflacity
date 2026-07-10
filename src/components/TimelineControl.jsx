import { formatDateKey } from '../data/inflationMath.js';

/**
 * Seletor de data minimalista, integrado ao mundo.
 */
export default function TimelineControl({
  periods,
  endDate,
  onEndDateChange,
  mode,
  onModeChange,
}) {
  if (!periods?.length) return null;

  const index = Math.max(0, periods.indexOf(endDate));
  const minLabel = formatDateKey(periods[0]);
  const maxLabel = formatDateKey(periods[periods.length - 1]);
  const currentLabel = formatDateKey(endDate || periods[periods.length - 1]);

  return (
    <div className="world-hud__timeline">
      <span className="world-hud__date-bound">{minLabel}</span>
      <div className="world-hud__slider">
        <input
          type="range"
          min={0}
          max={periods.length - 1}
          step={1}
          value={index < 0 ? periods.length - 1 : index}
          onChange={(e) => onEndDateChange(periods[Number(e.target.value)])}
          aria-label="Data final"
        />
        <div className="world-hud__date-now">{currentLabel}</div>
      </div>
      <span className="world-hud__date-bound">{maxLabel}</span>

      <div className="world-hud__mode" role="group" aria-label="Modo de altura">
        <button
          type="button"
          className={mode === 'accumulated' ? 'active' : ''}
          onClick={() => onModeChange('accumulated')}
          title="Acumulado desde a base"
        >
          Σ
        </button>
        <button
          type="button"
          className={mode === 'twelveMonths' ? 'active' : ''}
          onClick={() => onModeChange('twelveMonths')}
          title="Últimos 12 meses"
        >
          12m
        </button>
      </div>
    </div>
  );
}
