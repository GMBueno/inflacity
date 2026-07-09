import {
  formatPct,
  formatFloors,
  formatDateKey,
} from '../data/inflationMath.js';

/**
 * Painel lateral com detalhes do prédio selecionado.
 */
export default function InfoPanel({ building, mode, onClose }) {
  if (!building) {
    return (
      <aside className="info-panel info-panel--empty">
        <div className="info-panel__placeholder">
          <div className="info-panel__icon">🏙️</div>
          <h3>Explore a cidade</h3>
          <p>
            Clique em um prédio para ver a inflação acumulada daquele grupo do
            IPCA desde a data-base.
          </p>
        </div>
      </aside>
    );
  }

  const { group, stats } = building;
  const modeLabel =
    mode === 'twelveMonths'
      ? 'Variação nos últimos 12 meses'
      : 'Acumulado desde a data-base';

  return (
    <aside className="info-panel">
      <div className="info-panel__header">
        <div
          className="info-panel__swatch"
          style={{ background: group.color, boxShadow: `0 0 16px ${group.color}66` }}
        />
        <div className="info-panel__titles">
          <span className="info-panel__eyebrow">Grupo {group.id} · IPCA</span>
          <h2>{group.fullName}</h2>
        </div>
        <button
          type="button"
          className="info-panel__close"
          onClick={onClose}
          aria-label="Fechar painel"
        >
          ×
        </button>
      </div>

      <div className="info-panel__hero" style={{ borderColor: `${group.color}44` }}>
        <div className="info-panel__big" style={{ color: group.color }}>
          {formatPct(stats.inflationPct)}
        </div>
        <div className="info-panel__hero-label">{modeLabel}</div>
      </div>

      <dl className="info-panel__grid">
        <div>
          <dt>Andares equivalentes</dt>
          <dd>
            {formatFloors(stats.floors)}
            <span className="info-panel__unit"> andares</span>
          </dd>
        </div>
        <div>
          <dt>Índice (base = 1)</dt>
          <dd>
            {stats.index?.toLocaleString('pt-BR', {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}
          </dd>
        </div>
        <div>
          <dt>Data inicial</dt>
          <dd>{formatDateKey(stats.startDate)}</dd>
        </div>
        <div>
          <dt>Data final</dt>
          <dd>{formatDateKey(stats.endDate)}</dd>
        </div>
        <div>
          <dt>Última variação mensal</dt>
          <dd>
            {stats.lastMonthly != null ? formatPct(stats.lastMonthly) : '—'}
          </dd>
        </div>
        <div>
          <dt>Peso mensal mais recente</dt>
          <dd>
            {stats.latestWeight != null
              ? `${stats.latestWeight.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                })}%`
              : '—'}
          </dd>
        </div>
        <div>
          <dt>Meses na conta</dt>
          <dd>{stats.monthsUsed ?? '—'}</dd>
        </div>
      </dl>

      <div className="info-panel__hint">
        <strong>Como ler:</strong> cada prédio começa com 10 andares na
        data-base. Se os preços dobraram desde então, o prédio terá 20 andares.
        Altura = 10 × índice acumulado (só variação mensal, desde a data-base).
      </div>
    </aside>
  );
}
