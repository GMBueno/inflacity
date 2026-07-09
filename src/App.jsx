import { useCallback, useEffect, useMemo, useState } from 'react';
import CityScene from './components/CityScene.jsx';
import InfoPanel from './components/InfoPanel.jsx';
import TimelineControl from './components/TimelineControl.jsx';
import Tooltip from './components/Tooltip.jsx';
import { parseUnifiedCsv } from './data/parseUnified.js';
import { IPCA_GROUPS } from './data/groups.js';
import {
  calculateAccumulatedIndex,
  calculateTwelveMonthInflation,
  formatDateKey,
} from './data/inflationMath.js';

/** Dataset unificado (2938 + 1419 + 7060) gerado por `npm run build:data` */
const CSV_URL = '/data/ipca_grupos_unificado.csv';

/**
 * Cidade da Inflação — app principal.
 * Carrega o CSV unificado, calcula índices e orquestra a cena 3D + UI.
 */
export default function App() {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState(null);

  const [endDate, setEndDate] = useState(null);
  const [mode, setMode] = useState('accumulated'); // accumulated | twelveMonths
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [cameraResetKey, setCameraResetKey] = useState(0);

  // Tooltip position (mouse)
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setStatus('loading');
        const res = await fetch(CSV_URL);
        if (res.status === 404) {
          throw new Error(
            'Dataset unificado não encontrado. Rode npm run build:data para gerar o dataset unificado.'
          );
        }
        if (!res.ok) {
          throw new Error(
            `Não foi possível carregar ${CSV_URL} (HTTP ${res.status}). Rode npm run build:data.`
          );
        }
        const text = await res.text();
        if (!text.trim() || text.trim().startsWith('<!')) {
          throw new Error(
            'Rode npm run build:data para gerar o dataset unificado.'
          );
        }
        const result = parseUnifiedCsv(text);
        if (cancelled) return;

        if (!result.periods.length) {
          throw new Error(
            'Dataset unificado sem períodos. Verifique os CSVs e rode npm run build:data novamente.'
          );
        }

        setParsed(result);
        const last = result.periods[result.periods.length - 1] || null;
        setEndDate(last);
        setStatus('ready');

        console.info('[App] Dataset unificado carregado:', result.meta);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || String(err));
          setStatus('error');
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Stats por grupo na data/modo atuais
  const buildingStats = useMemo(() => {
    if (!parsed) return {};
    const out = {};
    for (const meta of IPCA_GROUPS) {
      const data = parsed.groups[meta.id];
      const series = data?.series || [];
      const stats =
        mode === 'twelveMonths'
          ? calculateTwelveMonthInflation(series, endDate)
          : calculateAccumulatedIndex(series, endDate);

      let latestWeight = null;
      for (let j = series.length - 1; j >= 0; j--) {
        if (endDate && series[j].dateKey > endDate) continue;
        if (series[j].weight != null) {
          latestWeight = series[j].weight;
          break;
        }
      }

      out[meta.id] = {
        group: { ...meta, ...(data || {}) },
        stats: { ...stats, latestWeight },
      };
    }
    return out;
  }, [parsed, endDate, mode]);

  const selectedBuilding = selectedId ? buildingStats[selectedId] : null;
  const hoveredBuilding = hoveredId ? buildingStats[hoveredId] : null;

  const baseDate = parsed?.periods?.[0] || null;

  const handleMouseMove = useCallback((e) => {
    setMouse({ x: e.clientX, y: e.clientY });
  }, []);

  if (status === 'loading') {
    return (
      <div className="app-shell app-shell--center">
        <div className="loader">
          <div className="loader__skyline" aria-hidden />
          <h1>Cidade da Inflação</h1>
          <p>Carregando dados do IPCA…</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    const needsBuildData =
      error &&
      (error.includes('build:data') ||
        error.includes('unificado') ||
        error.includes('404'));

    return (
      <div className="app-shell app-shell--center">
        <div className="error-box">
          <h1>Erro ao carregar dados</h1>
          <p>{error}</p>
          <p className="error-box__hint">
            {needsBuildData ? (
              <>
                Rode <code>npm run build:data</code> para gerar o dataset
                unificado a partir de <code>tabela2938.csv</code>,{' '}
                <code>tabela1419.csv</code> e <code>tabela7060.csv</code> em{' '}
                <code>public/data/</code>.
              </>
            ) : (
              <>
                Verifique <code>public/data/ipca_grupos_unificado.csv</code> ou
                regenere com <code>npm run build:data</code>.
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  const groupsFound = Object.values(parsed.groups).filter(
    (g) => g.series?.length
  ).length;

  return (
    <div className="app-shell" onMouseMove={handleMouseMove}>
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-header__mark" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div>
            <h1>Cidade da Inflação</h1>
            <p className="app-header__subtitle">
              Cada prédio mostra quanto os preços de um grupo do IPCA cresceram
              desde a data-base.
            </p>
          </div>
        </div>
        <div className="app-header__meta">
          <span className="pill">
            {groupsFound}/9 grupos · {parsed.periods.length} meses
          </span>
          <span className="pill pill--muted">
            {formatDateKey(baseDate)} → {formatDateKey(endDate)}
          </span>
          <span className="pill pill--muted">Fonte: IBGE / SIDRA 2938+1419+7060</span>
        </div>
      </header>

      <main className="app-main">
        <div className="app-stage">
          <CityScene
            groupsData={parsed.groups}
            endDate={endDate}
            mode={mode}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onSelect={setSelectedId}
            cameraResetKey={cameraResetKey}
          />

          <TimelineControl
            periods={parsed.periods}
            endDate={endDate}
            onEndDateChange={setEndDate}
            mode={mode}
            onModeChange={setMode}
            onResetCamera={() => setCameraResetKey((k) => k + 1)}
            baseDate={baseDate}
          />
        </div>

        <InfoPanel
          building={selectedBuilding}
          mode={mode}
          onClose={() => setSelectedId(null)}
        />
      </main>

      <Tooltip
        building={hoveredBuilding}
        mode={mode}
        x={mouse.x + 16}
        y={mouse.y + 16}
        visible={Boolean(hoveredId) && hoveredId !== selectedId}
      />
    </div>
  );
}
