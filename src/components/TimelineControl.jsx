import { formatDateKey } from '../data/inflationMath.js';

/**
 * Controles: data final, modo acumulado/12 meses, reset câmera.
 */
export default function TimelineControl({
  periods,
  endDate,
  onEndDateChange,
  mode,
  onModeChange,
  onResetCamera,
  baseDate,
}) {
  if (!periods?.length) return null;

  const index = Math.max(0, periods.indexOf(endDate));
  const minLabel = formatDateKey(periods[0]);
  const maxLabel = formatDateKey(periods[periods.length - 1]);
  const currentLabel = formatDateKey(endDate || periods[periods.length - 1]);

  return (
    <div className="timeline">
      <div className="timeline__row">
        <div className="timeline__field">
          <label htmlFor="end-date-slider">Data final</label>
          <div className="timeline__slider-wrap">
            <span className="timeline__bound">{minLabel}</span>
            <input
              id="end-date-slider"
              type="range"
              min={0}
              max={periods.length - 1}
              step={1}
              value={index < 0 ? periods.length - 1 : index}
              onChange={(e) => {
                const i = Number(e.target.value);
                onEndDateChange(periods[i]);
              }}
            />
            <span className="timeline__bound">{maxLabel}</span>
          </div>
          <div className="timeline__current">
            Exibindo até <strong>{currentLabel}</strong>
            {baseDate && mode === 'accumulated' && (
              <span className="timeline__base">
                {' '}
                · base {formatDateKey(baseDate)}
              </span>
            )}
          </div>
        </div>

        <div className="timeline__modes">
          <span className="timeline__modes-label">Altura dos prédios</span>
          <div className="timeline__toggle" role="group" aria-label="Modo de altura">
            <button
              type="button"
              className={mode === 'accumulated' ? 'active' : ''}
              onClick={() => onModeChange('accumulated')}
            >
              Acumulado desde a base
            </button>
            <button
              type="button"
              className={mode === 'twelveMonths' ? 'active' : ''}
              onClick={() => onModeChange('twelveMonths')}
            >
              Últimos 12 meses
            </button>
          </div>
        </div>

        <button type="button" className="timeline__reset" onClick={onResetCamera}>
          Reset câmera
        </button>
      </div>
    </div>
  );
}
