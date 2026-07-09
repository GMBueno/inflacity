/**
 * Matemática de inflação a partir de variações mensais.
 *
 * índice_base = 1
 * índice_t = índice_{t-1} * (1 + variação_mensal / 100)
 * andares = 10 * índice_final
 */

/**
 * Calcula o índice acumulado de uma série de variações mensais até endDate (inclusive).
 * @param {Array<{ dateKey: string, monthly: number }>} series
 * @param {string|null} endDate - chave YYYY-MM; se null, usa o último mês
 * @param {string|null} startDate - chave YYYY-MM; se null, usa o primeiro mês
 * @returns {{ index: number, inflationPct: number, floors: number, monthsUsed: number, startDate: string|null, endDate: string|null, lastMonthly: number|null }}
 */
export function calculateAccumulatedIndex(series, endDate = null, startDate = null) {
  if (!series?.length) {
    return emptyResult();
  }

  const filtered = filterSeries(series, startDate, endDate);
  if (!filtered.length) return emptyResult();

  let index = 1;
  for (const point of filtered) {
    if (typeof point.monthly === 'number' && Number.isFinite(point.monthly)) {
      index *= 1 + point.monthly / 100;
    }
  }

  const last = filtered[filtered.length - 1];
  const first = filtered[0];

  return {
    index,
    inflationPct: (index - 1) * 100,
    floors: 10 * index,
    monthsUsed: filtered.length,
    startDate: first.dateKey,
    endDate: last.dateKey,
    lastMonthly: last.monthly,
  };
}

/**
 * Inflação nos últimos 12 meses até endDate.
 * Usa o produto das últimas 12 variações mensais disponíveis até a data.
 * @returns {{ index: number, inflationPct: number, floors: number, monthsUsed: number, startDate: string|null, endDate: string|null, lastMonthly: number|null }}
 */
export function calculateTwelveMonthInflation(series, endDate = null) {
  if (!series?.length) return emptyResult();

  const upTo = endDate
    ? series.filter((p) => p.dateKey <= endDate)
    : series.slice();

  if (!upTo.length) return emptyResult();

  const window = upTo.slice(-12);
  let index = 1;
  for (const point of window) {
    if (typeof point.monthly === 'number' && Number.isFinite(point.monthly)) {
      index *= 1 + point.monthly / 100;
    }
  }

  const last = window[window.length - 1];
  const first = window[0];

  return {
    index,
    inflationPct: (index - 1) * 100,
    // Em modo 12 meses: 10 andares = 0% no período (índice 1)
    floors: 10 * index,
    monthsUsed: window.length,
    startDate: first.dateKey,
    endDate: last.dateKey,
    lastMonthly: last.monthly,
  };
}

/**
 * Altura 3D a partir de andares.
 * altura_3d = andares * 0.4
 */
export function floorsToHeight(floors) {
  return Math.max(floors, 1) * 0.4;
}

/**
 * Formata percentual no padrão BR: +61,4%
 */
export function formatPct(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return (
    sign +
    value.toLocaleString('pt-BR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }) +
    '%'
  );
}

/**
 * Formata número de andares: 16,1
 */
export function formatFloors(floors, digits = 1) {
  if (floors == null || !Number.isFinite(floors)) return '—';
  return floors.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Converte dateKey YYYY-MM para rótulo legível "jan/2020"
 */
export function formatDateKey(dateKey) {
  if (!dateKey) return '—';
  const [y, m] = dateKey.split('-').map(Number);
  const months = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  if (!y || !m || m < 1 || m > 12) return dateKey;
  return `${months[m - 1]}/${y}`;
}

function filterSeries(series, startDate, endDate) {
  return series.filter((p) => {
    if (startDate && p.dateKey < startDate) return false;
    if (endDate && p.dateKey > endDate) return false;
    return true;
  });
}

function emptyResult() {
  return {
    index: 1,
    inflationPct: 0,
    floors: 10,
    monthsUsed: 0,
    startDate: null,
    endDate: null,
    lastMonthly: null,
  };
}
