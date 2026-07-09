import { IPCA_GROUPS } from '../data/groups.js';

/**
 * Legenda da metáfora dos andares + cores dos grupos.
 */
export default function Legend({ onSelectGroup, selectedId }) {
  return (
    <div className="legend">
      <div className="legend__formula">
        <div className="legend__title">Como ler a cidade</div>
        <p>
          Cada prédio começa com <strong>10 andares</strong> na data-base. Se os
          preços dobraram desde então, o prédio terá{' '}
          <strong>20 andares</strong>. Se triplicaram,{' '}
          <strong>30 andares</strong>.
        </p>
        <p className="legend__sub">
          Altura = 10 × índice acumulado · índice_t = índice_{'{t-1}'} × (1 +
          var. mensal / 100)
        </p>
      </div>

      <ul className="legend__groups">
        {IPCA_GROUPS.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              className={`legend__chip ${selectedId === g.id ? 'active' : ''}`}
              onClick={() => onSelectGroup?.(g.id)}
            >
              <span
                className="legend__dot"
                style={{ background: g.color, boxShadow: `0 0 8px ${g.color}` }}
              />
              {g.shortName}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
