import { useCallback, useEffect, useMemo, useState } from 'react';
import CityScene from './components/CityScene.jsx';
import InfoPanel from './components/InfoPanel.jsx';
import TimelineControl from './components/TimelineControl.jsx';
import Tooltip from './components/Tooltip.jsx';
import { parseUnifiedCsv } from './data/parseUnified.js';
import { parseProductsUnifiedCsv } from './data/parseProductsUnified.js';
import { IPCA_GROUPS } from './data/groups.js';
import { ISLANDS } from './data/islands.js';
import {
  calculateAccumulatedIndex,
  calculateTwelveMonthInflation,
  formatDateKey,
} from './data/inflationMath.js';

const BASE = import.meta.env.BASE_URL;
const GROUPS_CSV = `${BASE}data/ipca_grupos_unificado.csv`;
const PRODUCTS_CSV = `${BASE}data/ipca_selecionados_unificado.csv`;

/**
 * Cidade da Inflação — app principal.
 * Duas ilhas: grupos IPCA + produtos selecionados.
 */
export default function App() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [groupsParsed, setGroupsParsed] = useState(null);
  const [productsParsed, setProductsParsed] = useState(null);

  const [endDate, setEndDate] = useState(null);
  const [mode, setMode] = useState('accumulated');
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const [activeIsland, setActiveIsland] = useState('groups');
  const [teleportToken, setTeleportToken] = useState(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setStatus('loading');

        const [gRes, pRes] = await Promise.all([
          fetch(GROUPS_CSV),
          fetch(PRODUCTS_CSV),
        ]);

        if (gRes.status === 404 || !gRes.ok) {
          throw new Error(
            'Dataset de grupos não encontrado. Rode npm run build:data para gerar o dataset unificado.'
          );
        }

        const gText = await gRes.text();
        if (!gText.trim() || gText.trim().startsWith('<!')) {
          throw new Error(
            'Rode npm run build:data para gerar o dataset unificado.'
          );
        }
        const groups = parseUnifiedCsv(gText);

        let products = null;
        if (pRes.ok) {
          const pText = await pRes.text();
          if (pText.trim() && !pText.trim().startsWith('<!')) {
            products = parseProductsUnifiedCsv(pText);
          }
        }

        if (cancelled) return;

        if (!groups.periods.length) {
          throw new Error('Dataset de grupos sem períodos.');
        }

        setGroupsParsed(groups);
        setProductsParsed(products);
        setEndDate(groups.periods[groups.periods.length - 1]);
        setStatus('ready');

        console.info('[App] Grupos:', groups.meta);
        console.info('[App] Selecionados:', products?.meta || 'ausente');
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

  // Períodos e base da ilha ativa
  const activePeriods = useMemo(() => {
    if (activeIsland === 'selected' && productsParsed?.periods?.length) {
      return productsParsed.periods;
    }
    return groupsParsed?.periods || [];
  }, [activeIsland, groupsParsed, productsParsed]);

  const baseDate = activePeriods[0] || null;

  // Ao trocar de ilha, ajusta endDate para o intervalo disponível
  useEffect(() => {
    if (!activePeriods.length) return;
    setEndDate((prev) => {
      if (!prev) return activePeriods[activePeriods.length - 1];
      if (prev < activePeriods[0]) return activePeriods[0];
      if (prev > activePeriods[activePeriods.length - 1]) {
        return activePeriods[activePeriods.length - 1];
      }
      // Garante que a data existe no array (pode haver buracos)
      if (!activePeriods.includes(prev)) {
        // pega a mais próxima ≤ prev
        let best = activePeriods[0];
        for (const p of activePeriods) {
          if (p <= prev) best = p;
          else break;
        }
        return best;
      }
      return prev;
    });
    setSelectedId(null);
  }, [activeIsland, activePeriods]);

  const buildingStats = useMemo(() => {
    const out = {};
    if (groupsParsed) {
      for (const meta of IPCA_GROUPS) {
        const data = groupsParsed.groups[meta.id];
        const series = data?.series || [];
        const stats =
          mode === 'twelveMonths'
            ? calculateTwelveMonthInflation(series, endDate)
            : calculateAccumulatedIndex(series, endDate);
        out[meta.id] = {
          group: { ...meta, ...(data || {}) },
          stats,
        };
      }
    }
    if (productsParsed?.products) {
      for (const code of Object.keys(productsParsed.products)) {
        const meta = productsParsed.products[code];
        const series = meta.series || [];
        const seriesStart = series[0]?.dateKey;
        const effectiveEnd =
          endDate && seriesStart && endDate < seriesStart ? seriesStart : endDate;
        const hasData = series.some((p) => !effectiveEnd || p.dateKey <= effectiveEnd);
        const stats = !hasData
          ? {
              index: 1,
              inflationPct: 0,
              floors: 10,
              monthsUsed: 0,
              startDate: seriesStart,
              endDate: null,
              lastMonthly: null,
              noDataYet: true,
            }
          : mode === 'twelveMonths'
            ? calculateTwelveMonthInflation(series, effectiveEnd)
            : calculateAccumulatedIndex(series, effectiveEnd);
        const id = `sel:${code}`;
        out[id] = {
          group: { ...meta, id, code, fullName: meta.fullName },
          stats,
        };
      }
    }
    return out;
  }, [groupsParsed, productsParsed, endDate, mode]);

  const selectedBuilding = selectedId != null ? buildingStats[selectedId] : null;
  const hoveredBuilding = hoveredId != null ? buildingStats[hoveredId] : null;

  const handleMouseMove = useCallback((e) => {
    setMouse({ x: e.clientX, y: e.clientY });
  }, []);

  const goToIsland = useCallback((islandId) => {
    setActiveIsland(islandId);
    setTeleportToken({ islandId, t: Date.now() });
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
    return (
      <div className="app-shell app-shell--center">
        <div className="error-box">
          <h1>Erro ao carregar dados</h1>
          <p>{error}</p>
          <p className="error-box__hint">
            Rode <code>npm run build:data</code> com os CSVs em{' '}
            <code>public/data/</code> e <code>public/data/selecionados/</code>.
          </p>
        </div>
      </div>
    );
  }

  const groupsFound = Object.values(groupsParsed.groups).filter(
    (g) => g.series?.length
  ).length;
  const productsFound = productsParsed
    ? Object.keys(productsParsed.products).length
    : 0;

  const islandMeta = ISLANDS[activeIsland] || ISLANDS.groups;
  const limitedHistory =
    activeIsland === 'selected' &&
    productsParsed?.meta?.minDate &&
    groupsParsed?.meta?.minDate &&
    productsParsed.meta.minDate > groupsParsed.meta.minDate;

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
              Cada prédio mostra quanto os preços cresceram desde a data-base.
              Explore as ilhas com WASD.
            </p>
          </div>
        </div>
        <div className="app-header__meta">
          <span className="pill">
            {groupsFound} grupos
            {productsFound ? ` · ${productsFound} selecionados` : ''}
          </span>
          <span className="pill pill--muted">
            {formatDateKey(baseDate)} → {formatDateKey(endDate)}
          </span>
          <span className="pill" style={{ borderColor: islandMeta.accent }}>
            {islandMeta.name}
          </span>
        </div>
      </header>

      <main className="app-main">
        <div className="app-stage">
          <CityScene
            groupsData={groupsParsed.groups}
            productsData={productsParsed}
            endDate={endDate}
            mode={mode}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onSelect={setSelectedId}
            cameraResetKey={cameraResetKey}
            onActiveIslandChange={setActiveIsland}
            teleportToken={teleportToken}
          />

          <div className="island-nav">
            <button
              type="button"
              className={activeIsland === 'groups' ? 'active' : ''}
              onClick={() => goToIsland('groups')}
            >
              Ilha dos Grupos
            </button>
            <button
              type="button"
              className={activeIsland === 'selected' ? 'active' : ''}
              onClick={() => goToIsland('selected')}
              disabled={!productsParsed}
            >
              Ilha dos Selecionados
            </button>
          </div>

          <div className="controls-hint">
            <kbd>WASD</kbd> mover · <kbd>Space</kbd> subir · <kbd>Ctrl</kbd> descer ·{' '}
            <kbd>Shift</kbd> correr · mouse orbitar
          </div>

          <TimelineControl
            periods={activePeriods}
            endDate={endDate}
            onEndDateChange={setEndDate}
            mode={mode}
            onModeChange={setMode}
            onResetCamera={() => setCameraResetKey((k) => k + 1)}
            baseDate={baseDate}
            islandLabel={islandMeta.name}
            limitedHistoryNote={
              limitedHistory
                ? `Esta ilha só tem série a partir de ${formatDateKey(productsParsed.meta.minDate)}. Quando você adicionar CSVs mais antigos em public/data/selecionados/, o histórico se estende sozinho.`
                : null
            }
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
        visible={hoveredId != null && hoveredId !== selectedId}
      />
    </div>
  );
}
