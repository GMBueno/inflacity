/**
 * Parser tolerante para exports CSV do SIDRA (tabela 7060 e similares).
 *
 * Suporta:
 * 1) Formato "matriz" (pivot) do SIDRA web — meses nas colunas, grupos nas linhas
 * 2) Formato "longo" — uma linha por (período × grupo × variável)
 *
 * Separador: detecta `;` ou `,`
 * Decimais: aceita "1,23" e "1.23"
 */

import Papa from 'papaparse';
import { matchGroup, IPCA_GROUPS } from './groups.js';

const MONTH_PT = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubre: 10,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

/**
 * Converte valores SIDRA ("1,23", "1.23", "19.3483", "...") para number | null.
 */
export function normalizeSidraNumber(value) {
  if (value == null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  let s = String(value).trim();
  if (!s) return null;

  // Valores especiais SIDRA
  if (
    s === '...' ||
    s === '..' ||
    s === '-' ||
    s === 'X' ||
    s === 'x' ||
    s.toLowerCase() === 'null' ||
    s === '%'
  ) {
    return null;
  }

  // Remove símbolo de % e espaços
  s = s.replace(/%/g, '').replace(/\s/g, '').trim();
  if (!s) return null;

  // Se tem vírgula e ponto: assume BR (1.234,56) ou US (1,234.56)
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // 1.234,56 → BR
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 → US
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Só vírgula: "1,23" → 1.23
    s = s.replace(',', '.');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Converte rótulos de período SIDRA em chave YYYY-MM.
 * Aceita: "janeiro 2020", "jan/2020", "2020-01", "202001", "01/2020"
 */
export function parsePeriodToKey(label) {
  if (!label) return null;
  const raw = String(label).trim().toLowerCase();
  if (!raw) return null;

  // YYYY-MM
  let m = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}`;

  // YYYYMM
  m = raw.match(/^(\d{4})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;

  // MM/YYYY ou M/YYYY
  m = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${String(Number(m[1])).padStart(2, '0')}`;

  // "janeiro 2020" / "janeiro/2020" / "jan 2020"
  m = raw.match(/^([a-záàâãéêíóôõúç]+)\s*[\/\-]?\s*(\d{4})$/i);
  if (m) {
    const monthName = m[1]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const monthNum = MONTH_PT[monthName] || MONTH_PT[m[1]];
    if (monthNum) {
      return `${m[2]}-${String(monthNum).padStart(2, '0')}`;
    }
  }

  // Código SIDRA tipo 202001 (às vezes vem como número)
  m = raw.match(/^(\d{6})$/);
  if (m) {
    const y = m[1].slice(0, 4);
    const mo = m[1].slice(4, 6);
    return `${y}-${mo}`;
  }

  return null;
}

/**
 * Detecta se a coluna/texto se refere à variação mensal.
 */
function isMonthlyVariation(text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  // Preferir "variação mensal" e evitar "acumulada"
  if (t.includes('acumulad')) return false;
  if (t.includes('peso')) return false;
  return (
    t.includes('variação mensal') ||
    t.includes('variacao mensal') ||
    (t.includes('variação') && t.includes('mensal')) ||
    (t.includes('variacao') && t.includes('mensal')) ||
    t === 'ipca - variação mensal' ||
    t.includes('var. mensal')
  );
}

/**
 * Detecta se é peso mensal.
 */
function isMonthlyWeight(text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  return t.includes('peso mensal') || (t.includes('peso') && t.includes('mensal'));
}

/**
 * Entrada principal: parseia o texto CSV completo.
 * @returns {{
 *   groups: Record<number, { id, fullName, shortName, color, emissive, series: Array }>,
 *   periods: string[],
 *   meta: object
 * }}
 */
export function parseSidraCsv(csvText) {
  if (!csvText || !String(csvText).trim()) {
    throw new Error('CSV vazio.');
  }

  // Remove BOM
  const text = String(csvText).replace(/^\uFEFF/, '');

  // Detecta separador pelas primeiras linhas
  const sample = text.split(/\r?\n/).slice(0, 8).join('\n');
  const semicolons = (sample.match(/;/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  // SIDRA pivot export usa vírgula; long format BR costuma usar ;
  const delimiter = semicolons > commas * 1.5 ? ';' : ',';

  const parsed = Papa.parse(text, {
    delimiter,
    skipEmptyLines: false,
    quoteChar: '"',
  });

  const rows = parsed.data.map((row) =>
    row.map((cell) => (cell == null ? '' : String(cell).trim()))
  );

  // Log colunas úteis para debug
  const nonEmptyHeaders = [];
  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const filled = rows[r]
      .map((c, i) => (c ? `${i}:${c.slice(0, 40)}` : null))
      .filter(Boolean);
    if (filled.length) nonEmptyHeaders.push({ row: r, cells: filled.slice(0, 15) });
  }
  console.info('[parseSidra] Amostra de colunas encontradas:', nonEmptyHeaders);
  console.info(`[parseSidra] Delimitador detectado: "${delimiter}"`);

  // Tenta formato matriz (pivot) primeiro — comum no export SIDRA 7060
  const matrixResult = tryParseMatrixFormat(rows);
  if (matrixResult) {
    console.info(
      `[parseSidra] Formato matriz detectado. Grupos: ${Object.keys(matrixResult.groups).length}, períodos: ${matrixResult.periods.length}`
    );
    return matrixResult;
  }

  // Fallback: formato longo (tidy)
  const longResult = tryParseLongFormat(rows);
  if (longResult) {
    console.info(
      `[parseSidra] Formato longo detectado. Grupos: ${Object.keys(longResult.groups).length}, períodos: ${longResult.periods.length}`
    );
    return longResult;
  }

  throw new Error(
    'Não foi possível interpretar o CSV do SIDRA. Verifique se há variação mensal dos 9 grupos do IPCA.'
  );
}

/**
 * Formato matriz:
 * - Linha de meses: "janeiro 2020", "fevereiro 2020", ...
 * - Linha de variáveis: "IPCA - Variação mensal", "IPCA - Peso mensal", ...
 * - Linhas de dados: "1.Alimentação e bebidas", valores...
 */
function tryParseMatrixFormat(rows) {
  // Encontra linha de meses e linha de variáveis
  let monthRowIdx = -1;
  let varRowIdx = -1;

  for (let i = 0; i < Math.min(12, rows.length); i++) {
    const periodCount = rows[i].filter((c) => parsePeriodToKey(c)).length;
    if (periodCount >= 3 && monthRowIdx < 0) {
      monthRowIdx = i;
    }
    const varCount = rows[i].filter(
      (c) => isMonthlyVariation(c) || isMonthlyWeight(c)
    ).length;
    if (varCount >= 2 && varRowIdx < 0) {
      varRowIdx = i;
    }
  }

  if (monthRowIdx < 0 || varRowIdx < 0) return null;

  const monthRow = rows[monthRowIdx];
  const varRow = rows[varRowIdx];

  // Forward-fill dos meses (células mescladas vazias)
  const monthAtCol = [];
  let lastMonth = null;
  for (let c = 0; c < Math.max(monthRow.length, varRow.length); c++) {
    const p = parsePeriodToKey(monthRow[c]);
    if (p) lastMonth = p;
    monthAtCol[c] = lastMonth;
  }

  // Mapeia colunas de variação mensal e peso
  const monthlyCols = []; // { col, dateKey }
  const weightCols = [];

  for (let c = 0; c < varRow.length; c++) {
    const v = varRow[c];
    const dateKey = monthAtCol[c];
    if (!dateKey) continue;
    if (isMonthlyVariation(v)) {
      monthlyCols.push({ col: c, dateKey });
    } else if (isMonthlyWeight(v)) {
      weightCols.push({ col: c, dateKey });
    }
  }

  if (monthlyCols.length < 2) return null;

  const groups = {};
  let dataRowsFound = 0;

  for (let r = varRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row[0]) continue;

    // Pula rodapé / notas
    const label = row[0];
    if (/^(fonte|notas|legenda|símbolo|simbolo)/i.test(label)) break;
    if (label.length > 80 && !matchGroup(label)) continue;

    const group = matchGroup(label);
    if (!group) continue;

    dataRowsFound++;
    const seriesMap = new Map();

    for (const { col, dateKey } of monthlyCols) {
      const monthly = normalizeSidraNumber(row[col]);
      if (monthly == null) continue;
      if (!seriesMap.has(dateKey)) {
        seriesMap.set(dateKey, { dateKey, monthly: null, weight: null });
      }
      seriesMap.get(dateKey).monthly = monthly;
    }

    for (const { col, dateKey } of weightCols) {
      const weight = normalizeSidraNumber(row[col]);
      if (weight == null) continue;
      if (!seriesMap.has(dateKey)) {
        seriesMap.set(dateKey, { dateKey, monthly: null, weight: null });
      }
      seriesMap.get(dateKey).weight = weight;
    }

    const series = Array.from(seriesMap.values())
      .filter((p) => p.monthly != null)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    if (series.length) {
      groups[group.id] = {
        ...group,
        series,
        sourceLabel: label,
      };
    }
  }

  if (dataRowsFound === 0 || Object.keys(groups).length === 0) return null;

  const periods = collectPeriods(groups);

  return {
    groups,
    periods,
    meta: {
      format: 'matrix',
      monthlyColumns: monthlyCols.length,
      weightColumns: weightCols.length,
      groupsFound: Object.keys(groups).length,
    },
  };
}

/**
 * Formato longo: colunas com nomes variáveis (Mês, Variável, Valor, grupo...).
 */
function tryParseLongFormat(rows) {
  // Encontra a linha de cabeçalho
  let headerIdx = -1;
  let headers = [];

  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i];
    const joined = row.join(' ').toLowerCase();
    const looksLikeHeader =
      (joined.includes('variável') || joined.includes('variavel') || joined.includes('valor')) &&
      (joined.includes('mês') ||
        joined.includes('mes') ||
        joined.includes('período') ||
        joined.includes('periodo') ||
        joined.includes('grupo') ||
        joined.includes('geral'));

    if (looksLikeHeader) {
      headerIdx = i;
      headers = row.map((h) => h.toLowerCase());
      break;
    }
  }

  if (headerIdx < 0) {
    // Última tentativa: primeira linha com várias colunas não vazias
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      if (rows[i].filter(Boolean).length >= 3) {
        headerIdx = i;
        headers = rows[i].map((h) => h.toLowerCase());
        break;
      }
    }
  }

  if (headerIdx < 0) return null;

  console.info('[parseSidra] Cabeçalhos (long format):', headers);

  const col = {
    period: findCol(headers, [
      'mês (código)',
      'mes (codigo)',
      'mês',
      'mes',
      'período',
      'periodo',
      'data',
      'ano',
    ]),
    periodLabel: findCol(headers, ['mês', 'mes', 'período', 'periodo']),
    variable: findCol(headers, ['variável', 'variavel', 'variable']),
    value: findCol(headers, ['valor', 'value', 'v']),
    group: findCol(headers, [
      'geral, grupo, subgrupo, item e subitem',
      'grupo',
      'geral',
      'item',
      'produtos',
    ]),
  };

  // Se period e periodLabel coincidem, ok
  if (col.period < 0 && col.periodLabel >= 0) col.period = col.periodLabel;
  if (col.value < 0) {
    // Às vezes a última coluna numérica é o valor
    col.value = headers.length - 1;
  }

  if (col.group < 0 || col.period < 0) return null;

  const groups = {};
  const seriesMaps = {};

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.some(Boolean)) continue;

    const label = row[col.group] || '';
    if (/^(fonte|notas|legenda)/i.test(label)) break;

    const group = matchGroup(label);
    if (!group) continue;

    const variable =
      col.variable >= 0 ? row[col.variable] : 'IPCA - Variação mensal';

    // Só nos interessa variação mensal e peso
    const isMonthly = isMonthlyVariation(variable) || col.variable < 0;
    const isWeight = isMonthlyWeight(variable);
    if (!isMonthly && !isWeight) continue;

    // Se não há coluna de variável, assume que o valor é variação mensal
    if (col.variable < 0 && isWeight) continue;

    let dateKey = parsePeriodToKey(row[col.period]);
    if (!dateKey && col.periodLabel >= 0 && col.periodLabel !== col.period) {
      dateKey = parsePeriodToKey(row[col.periodLabel]);
    }
    // Código numérico 202001
    if (!dateKey) {
      const code = normalizeSidraNumber(row[col.period]);
      if (code != null && code > 200000) {
        const s = String(Math.round(code));
        if (s.length === 6) dateKey = `${s.slice(0, 4)}-${s.slice(4, 6)}`;
      }
    }
    if (!dateKey) continue;

    const value = normalizeSidraNumber(row[col.value]);
    if (value == null) continue;

    if (!seriesMaps[group.id]) {
      seriesMaps[group.id] = new Map();
      groups[group.id] = { ...group, series: [], sourceLabel: label };
    }

    if (!seriesMaps[group.id].has(dateKey)) {
      seriesMaps[group.id].set(dateKey, {
        dateKey,
        monthly: null,
        weight: null,
      });
    }

    const point = seriesMaps[group.id].get(dateKey);
    if (isWeight) {
      point.weight = value;
    } else {
      point.monthly = value;
    }
  }

  for (const id of Object.keys(seriesMaps)) {
    groups[id].series = Array.from(seriesMaps[id].values())
      .filter((p) => p.monthly != null)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    if (!groups[id].series.length) delete groups[id];
  }

  if (!Object.keys(groups).length) return null;

  return {
    groups,
    periods: collectPeriods(groups),
    meta: {
      format: 'long',
      columns: col,
      groupsFound: Object.keys(groups).length,
    },
  };
}

function findCol(headers, candidates) {
  for (const cand of candidates) {
    const c = cand.toLowerCase();
    // Match exato
    let idx = headers.findIndex((h) => h === c);
    if (idx >= 0) return idx;
    // Match parcial
    idx = headers.findIndex((h) => h.includes(c) || c.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

function collectPeriods(groups) {
  const set = new Set();
  for (const g of Object.values(groups)) {
    for (const p of g.series) set.add(p.dateKey);
  }
  return Array.from(set).sort();
}

/**
 * Garante que os 9 grupos existam (preenche vazios se faltarem no CSV).
 */
export function ensureAllGroups(parsed) {
  const groups = { ...parsed.groups };
  for (const meta of IPCA_GROUPS) {
    if (!groups[meta.id]) {
      groups[meta.id] = {
        ...meta,
        series: [],
        sourceLabel: meta.fullName,
        missing: true,
      };
    }
  }
  return { ...parsed, groups };
}
