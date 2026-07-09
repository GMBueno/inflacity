/**
 * Gera public/data/ipca_grupos_unificado.csv a partir de:
 *   - public/data/tabela2938.csv  (jul/2006 – dez/2011)
 *   - public/data/tabela1419.csv  (jan/2012 – dez/2019)
 *   - public/data/tabela7060.csv  (jan/2020 em diante)
 *
 * Uso: npm run build:data
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const OUTPUT = path.join(DATA_DIR, 'ipca_grupos_unificado.csv');

/**
 * Fontes SIDRA na ordem cronológica.
 * Em sobreposição de datas, preferredSource() escolhe a tabela canônica.
 */
const SOURCES = [
  { id: '2938', file: path.join(DATA_DIR, 'tabela2938.csv'), label: 'jul/2006–dez/2011' },
  { id: '1419', file: path.join(DATA_DIR, 'tabela1419.csv'), label: 'jan/2012–dez/2019' },
  { id: '7060', file: path.join(DATA_DIR, 'tabela7060.csv'), label: 'jan/2020→' },
];

/** 9 grupos canônicos do IPCA */
const CANONICAL_GROUPS = [
  { code: 1, name: 'Alimentação e bebidas', shortName: 'Alimentação', match: ['alimentacao', 'alimentacao e bebidas'] },
  { code: 2, name: 'Habitação', shortName: 'Habitação', match: ['habitacao'] },
  { code: 3, name: 'Artigos de residência', shortName: 'Residência', match: ['artigos de residencia', 'residencia'] },
  { code: 4, name: 'Vestuário', shortName: 'Vestuário', match: ['vestuario'] },
  { code: 5, name: 'Transportes', shortName: 'Transportes', match: ['transportes', 'transporte'] },
  { code: 6, name: 'Saúde e cuidados pessoais', shortName: 'Saúde', match: ['saude e cuidados pessoais', 'saude'] },
  { code: 7, name: 'Despesas pessoais', shortName: 'Pessoais', match: ['despesas pessoais'] },
  { code: 8, name: 'Educação', shortName: 'Educação', match: ['educacao'] },
  { code: 9, name: 'Comunicação', shortName: 'Comunicação', match: ['comunicacao'] },
];

const MONTH_PT = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, outubre: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function stripAccents(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(s) {
  return stripAccents(String(s || ''))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSidraNumber(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  let s = String(value).trim();
  if (!s) return null;
  if (['...', '..', '-', 'X', 'x', 'null', '%', '–', '—'].includes(s)) return null;

  s = s.replace(/%/g, '').replace(/\s/g, '').trim();
  if (!s) return null;

  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Converte rótulos de período SIDRA em data ISO YYYY-MM-01.
 */
function parsePeriodToDate(label) {
  if (label == null || label === '') return null;

  // Número puro (ex.: 201201)
  if (typeof label === 'number' && Number.isFinite(label)) {
    const s = String(Math.round(label));
    if (s.length === 6) {
      const y = s.slice(0, 4);
      const m = s.slice(4, 6);
      return `${y}-${m}-01`;
    }
  }

  const raw = String(label).trim().toLowerCase();
  if (!raw) return null;

  let m;

  // YYYY-MM or YYYY-MM-DD
  m = raw.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}-01`;

  // YYYYMM
  m = raw.match(/^(\d{4})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-01`;

  // MM/YYYY
  m = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${String(Number(m[1])).padStart(2, '0')}-01`;

  // "janeiro 2012", "jan/2012", "janeiro/2012"
  m = raw.match(/^([a-záàâãéêíóôõúç]+)\s*[\/\-]?\s*(\d{4})$/i);
  if (m) {
    const mon = MONTH_PT[normalizeText(m[1])] ?? MONTH_PT[m[1]];
    if (mon) return `${m[2]}-${String(mon).padStart(2, '0')}-01`;
  }

  // "2012 janeiro"
  m = raw.match(/^(\d{4})\s+([a-záàâãéêíóôõúç]+)$/i);
  if (m) {
    const mon = MONTH_PT[normalizeText(m[2])] ?? MONTH_PT[m[2]];
    if (mon) return `${m[1]}-${String(mon).padStart(2, '0')}-01`;
  }

  return null;
}

function isMonthlyVariation(text) {
  if (!text) return false;
  const t = normalizeText(text);
  if (t.includes('acumulad')) return false;
  if (t.includes('peso')) return false;
  return (
    t.includes('variacao mensal') ||
    (t.includes('variacao') && t.includes('mensal')) ||
    t.includes('var. mensal') ||
    t.includes('var mensal')
  );
}

/**
 * Resolve grupo: 1) código explícito / prefixo numérico  2) nome normalizado.
 * Nunca confia só em igualdade textual crua.
 */
function resolveGroup(label, codeHint = null) {
  // 1) Código confiável
  if (codeHint != null && codeHint !== '') {
    const n = Number(String(codeHint).replace(/[^\d]/g, ''));
    if (n >= 1 && n <= 9) {
      return CANONICAL_GROUPS.find((g) => g.code === n) || null;
    }
  }

  if (!label) return null;
  const raw = String(label).trim();

  // Prefixo "1." / "1 -" / "1 "
  const prefix = raw.match(/^(\d{1,2})\s*[\.\-\–—]\s*/);
  if (prefix) {
    const n = Number(prefix[1]);
    if (n >= 1 && n <= 9) {
      return CANONICAL_GROUPS.find((g) => g.code === n) || null;
    }
  }

  // Só dígito "1".."9"
  if (/^[1-9]$/.test(raw)) {
    return CANONICAL_GROUPS.find((g) => g.code === Number(raw)) || null;
  }

  // 2) Nome normalizado (fallback)
  const cleaned = normalizeText(raw.replace(/^\d+\s*[\.\-\–—]\s*/, ''));
  if (!cleaned || cleaned === 'indice geral' || cleaned === 'brasil') return null;

  // Ordem importa: "despesas pessoais" antes de "saude" genérico
  const ordered = [
    CANONICAL_GROUPS[6], // despesas pessoais
    CANONICAL_GROUPS[5], // saúde
    CANONICAL_GROUPS[0],
    CANONICAL_GROUPS[1],
    CANONICAL_GROUPS[2],
    CANONICAL_GROUPS[3],
    CANONICAL_GROUPS[4],
    CANONICAL_GROUPS[7],
    CANONICAL_GROUPS[8],
  ];

  for (const g of ordered) {
    for (const needle of g.match) {
      if (cleaned === needle || cleaned.includes(needle) || needle.includes(cleaned)) {
        // Evita "saude" capturar "despesas pessoais"
        if (g.code === 6 && cleaned.includes('despesas pessoais')) continue;
        if (g.code === 7 && !cleaned.includes('despesas')) continue;
        return g;
      }
    }
  }

  return null;
}

function detectDelimiter(sample) {
  const semicolons = (sample.match(/;/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  return semicolons > commas * 1.5 ? ';' : ',';
}

function parseCsvText(text) {
  const clean = String(text).replace(/^\uFEFF/, '');
  const sample = clean.split(/\r?\n/).slice(0, 10).join('\n');
  const delimiter = detectDelimiter(sample);
  const parsed = Papa.parse(clean, {
    delimiter,
    skipEmptyLines: false,
    quoteChar: '"',
  });
  const rows = parsed.data.map((row) =>
    row.map((cell) => (cell == null ? '' : String(cell).trim()))
  );
  return { rows, delimiter };
}

function logHeaderSample(rows, label) {
  const sample = [];
  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const cells = rows[r]
      .map((c, i) => (c ? `${i}:${c.slice(0, 48)}` : null))
      .filter(Boolean)
      .slice(0, 12);
    if (cells.length) sample.push({ row: r, cells });
  }
  console.log(`[${label}] Amostra de células:`, sample);
}

// ---------------------------------------------------------------------------
// Parsers SIDRA (formatos matrix)
// ---------------------------------------------------------------------------

/**
 * Formato 7060: grupos nas LINHAS, meses × variáveis nas COLUNAS.
 */
function parseGroupsAsRows(rows, sourceTable) {
  let monthRowIdx = -1;
  let varRowIdx = -1;

  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const periodCount = rows[i].filter((c) => parsePeriodToDate(c)).length;
    if (periodCount >= 3 && monthRowIdx < 0) monthRowIdx = i;

    const varCount = rows[i].filter((c) => isMonthlyVariation(c)).length;
    // Também conta se a linha tem vários nomes de variável IPCA
    const ipcaVarCount = rows[i].filter((c) =>
      normalizeText(c).includes('ipca')
    ).length;
    if ((varCount >= 1 || ipcaVarCount >= 2) && varRowIdx < 0 && i !== monthRowIdx) {
      // Prefer line that actually has "variação mensal"
      if (varCount >= 1) varRowIdx = i;
      else if (varRowIdx < 0 && ipcaVarCount >= 2) varRowIdx = i;
    }
  }

  // Refine var row: first row with isMonthlyVariation after month row
  if (monthRowIdx >= 0) {
    for (let i = monthRowIdx; i < Math.min(monthRowIdx + 6, rows.length); i++) {
      if (rows[i].some((c) => isMonthlyVariation(c))) {
        varRowIdx = i;
        break;
      }
    }
  }

  if (monthRowIdx < 0 || varRowIdx < 0) return null;

  const monthRow = rows[monthRowIdx];
  const varRow = rows[varRowIdx];

  // Forward-fill months
  const monthAtCol = [];
  let lastMonth = null;
  const maxCols = Math.max(monthRow.length, varRow.length);
  for (let c = 0; c < maxCols; c++) {
    const p = parsePeriodToDate(monthRow[c]);
    if (p) lastMonth = p;
    monthAtCol[c] = lastMonth;
  }

  const monthlyCols = [];
  for (let c = 0; c < varRow.length; c++) {
    if (!isMonthlyVariation(varRow[c])) continue;
    const date = monthAtCol[c];
    if (!date) continue;
    monthlyCols.push({ col: c, date });
  }

  if (monthlyCols.length < 2) return null;

  const records = [];
  let rawDataRows = 0;

  for (let r = varRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row[0]) continue;
    const label = row[0];
    if (/^(fonte|notas|legenda|simbolo|símbolo|tabela)/i.test(label)) break;

    const group = resolveGroup(label);
    if (!group) continue;
    rawDataRows++;

    for (const { col, date } of monthlyCols) {
      const monthly = normalizeSidraNumber(row[col]);
      if (monthly == null) continue;
      records.push(makeRecord(date, group, monthly, sourceTable));
    }
  }

  if (!records.length) return null;
  return { records, rawDataRows, format: 'groups-as-rows' };
}

/**
 * Formato 1419: variável em seção, meses e GRUPOS nas COLUNAS, território na linha.
 * Só extrai seções de "Variação mensal".
 */
function parseGroupsAsColumns(rows, sourceTable) {
  const records = [];
  let rawDataRows = 0;
  let sectionsUsed = 0;

  for (let i = 0; i < rows.length; i++) {
    const cell0 = rows[i][0] || '';
    // "Variável - IPCA - Variação mensal" ou similar
    const sectionText = rows[i].filter(Boolean).join(' ');
    if (!isMonthlyVariation(sectionText) && !isMonthlyVariation(cell0)) {
      continue;
    }
    // Evita capturar só por estar na mesma tabela se for acumulado
    if (!isMonthlyVariation(sectionText) && !isMonthlyVariation(cell0)) continue;

    // Busca nas próximas linhas: months, groups, data
    let monthRowIdx = -1;
    let groupRowIdx = -1;
    let dataRowIdx = -1;

    for (let j = i + 1; j < Math.min(i + 8, rows.length); j++) {
      const periodCount = rows[j].filter((c) => parsePeriodToDate(c)).length;
      if (periodCount >= 3 && monthRowIdx < 0) {
        monthRowIdx = j;
        continue;
      }
      const groupCount = rows[j].filter((c) => resolveGroup(c)).length;
      if (groupCount >= 3 && groupRowIdx < 0) {
        groupRowIdx = j;
        continue;
      }
      // Linha de dados: Brasil ou valores numéricos
      const numericCount = rows[j].filter((c) => normalizeSidraNumber(c) != null).length;
      const isBrasil = normalizeText(rows[j][0]) === 'brasil';
      if ((isBrasil || numericCount >= 9) && dataRowIdx < 0 && j !== monthRowIdx && j !== groupRowIdx) {
        dataRowIdx = j;
      }
    }

    if (monthRowIdx < 0 || groupRowIdx < 0 || dataRowIdx < 0) continue;

    sectionsUsed++;
    rawDataRows++;

    const monthRow = rows[monthRowIdx];
    const groupRow = rows[groupRowIdx];
    const dataRow = rows[dataRowIdx];

    // Forward-fill months across columns
    let lastDate = null;
    const maxCols = Math.max(monthRow.length, groupRow.length, dataRow.length);
    for (let c = 0; c < maxCols; c++) {
      const d = parsePeriodToDate(monthRow[c]);
      if (d) lastDate = d;

      const group = resolveGroup(groupRow[c]);
      if (!group || !lastDate) continue;

      const monthly = normalizeSidraNumber(dataRow[c]);
      if (monthly == null) continue;

      records.push(makeRecord(lastDate, group, monthly, sourceTable));
    }
  }

  if (!records.length) return null;
  return { records, rawDataRows, format: 'groups-as-columns', sectionsUsed };
}

/**
 * Formato longo (tidy): colunas período, grupo, variável, valor.
 */
function parseLongFormat(rows, sourceTable) {
  let headerIdx = -1;
  let headers = [];

  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const joined = rows[i].join(' ').toLowerCase();
    if (
      (joined.includes('valor') || joined.includes('variável') || joined.includes('variavel')) &&
      (joined.includes('mês') ||
        joined.includes('mes') ||
        joined.includes('grupo') ||
        joined.includes('geral') ||
        joined.includes('período') ||
        joined.includes('periodo'))
    ) {
      headerIdx = i;
      headers = rows[i].map((h) => normalizeText(h));
      break;
    }
  }

  if (headerIdx < 0) return null;

  console.log(`[${sourceTable}] Cabeçalhos long format:`, headers);

  const col = {
    period: findCol(headers, [
      'mes (codigo)',
      'mês (código)',
      'periodo',
      'período',
      'mes',
      'mês',
      'data',
      'ano',
    ]),
    periodLabel: findCol(headers, ['mes', 'mês', 'periodo', 'período']),
    variable: findCol(headers, ['variavel', 'variável', 'variable']),
    value: findCol(headers, ['valor', 'value']),
    group: findCol(headers, [
      'geral, grupo, subgrupo, item e subitem',
      'grupo',
      'geral',
      'item',
    ]),
    groupCode: findCol(headers, [
      'geral, grupo, subgrupo, item e subitem (codigo)',
      'grupo (codigo)',
      'codigo do grupo',
      'código do grupo',
    ]),
  };

  if (col.period < 0 && col.periodLabel >= 0) col.period = col.periodLabel;
  if (col.value < 0) col.value = headers.length - 1;
  if (col.group < 0) return null;
  if (col.period < 0) return null;

  const records = [];
  let rawDataRows = 0;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.some(Boolean)) continue;
    const label = row[col.group] || '';
    if (/^(fonte|notas|legenda)/i.test(label)) break;

    const variable = col.variable >= 0 ? row[col.variable] : 'IPCA - Variação mensal';
    if (col.variable >= 0 && !isMonthlyVariation(variable)) continue;

    const codeHint = col.groupCode >= 0 ? row[col.groupCode] : null;
    const group = resolveGroup(label, codeHint);
    if (!group) continue;

    let date = parsePeriodToDate(row[col.period]);
    if (!date && col.periodLabel >= 0 && col.periodLabel !== col.period) {
      date = parsePeriodToDate(row[col.periodLabel]);
    }
    if (!date) {
      const code = normalizeSidraNumber(row[col.period]);
      if (code != null && code > 200000) {
        const s = String(Math.round(code));
        if (s.length === 6) date = `${s.slice(0, 4)}-${s.slice(4, 6)}-01`;
      }
    }
    if (!date) continue;

    const monthly = normalizeSidraNumber(row[col.value]);
    if (monthly == null) continue;

    rawDataRows++;
    records.push(makeRecord(date, group, monthly, sourceTable));
  }

  if (!records.length) return null;
  return { records, rawDataRows, format: 'long' };
}

function findCol(headers, candidates) {
  for (const cand of candidates) {
    const c = normalizeText(cand);
    let idx = headers.findIndex((h) => h === c);
    if (idx >= 0) return idx;
    idx = headers.findIndex((h) => h.includes(c) || c.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

function makeRecord(dateIso, group, monthly, sourceTable) {
  const [y, m] = dateIso.split('-').map(Number);
  return {
    date: dateIso,
    year: y,
    month: m,
    group_code: group.code,
    group_name: group.name,
    short_name: group.shortName,
    monthly_variation: monthly,
    source_table: String(sourceTable),
  };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

function parseSidraFile(filePath, sourceTable) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const { rows, delimiter } = parseCsvText(text);
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim()).length;

  console.log(`\n========== Tabela ${sourceTable} ==========`);
  console.log(`Arquivo: ${filePath}`);
  console.log(`Linhas não vazias no arquivo: ${rawLines}`);
  console.log(`Linhas parseadas (Papa): ${rows.length}`);
  console.log(`Delimitador: "${delimiter}"`);
  logHeaderSample(rows, sourceTable);

  // Tenta formatos em ordem de especificidade
  let result =
    parseGroupsAsRows(rows, sourceTable) ||
    parseGroupsAsColumns(rows, sourceTable) ||
    parseLongFormat(rows, sourceTable);

  if (!result) {
    throw new Error(
      `Não foi possível interpretar ${path.basename(filePath)}. ` +
        'Verifique se há IPCA - Variação mensal dos 9 grupos.'
    );
  }

  // Dedup por date + group_code + source
  const map = new Map();
  for (const rec of result.records) {
    const key = `${rec.date}|${rec.group_code}|${rec.source_table}`;
    map.set(key, rec);
  }
  const unique = Array.from(map.values()).sort(
    (a, b) => a.date.localeCompare(b.date) || a.group_code - b.group_code
  );

  const dates = unique.map((r) => r.date).sort();
  const groups = [...new Set(unique.map((r) => r.group_code))].sort((a, b) => a - b);

  console.log(`Formato detectado: ${result.format}`);
  console.log(`Linhas de dados brutas (grupos/seções): ${result.rawDataRows}`);
  console.log(`Registros normalizados: ${unique.length}`);
  console.log(`Menor data: ${dates[0]}`);
  console.log(`Maior data: ${dates[dates.length - 1]}`);
  console.log(`Grupos encontrados: ${groups.join(', ')}`);

  return {
    records: unique,
    rawLines,
    rawDataRows: result.rawDataRows,
    minDate: dates[0],
    maxDate: dates[dates.length - 1],
    groups,
    format: result.format,
  };
}

/**
 * Tabela preferida por período (estruturas de ponderação do IPCA):
 *   até 2011-12 → 2938
 *   2012-01 … 2019-12 → 1419
 *   2020-01 em diante → 7060
 */
function preferredSource(dateIso) {
  const ym = String(dateIso).slice(0, 7);
  if (ym >= '2020-01') return '7060';
  if (ym >= '2012-01') return '1419';
  return '2938';
}

/**
 * Junta N datasets. Em duplicata date+group_code, mantém a tabela preferida
 * para aquele mês; se ela não tiver valor, usa qualquer outra disponível.
 * @param {Array<{ records: object[] }>} datasets
 */
function mergeDatasets(datasets) {
  /** @type {Map<string, Map<string, object>>} */
  const buckets = new Map();

  for (const ds of datasets) {
    for (const rec of ds.records) {
      const key = `${rec.date}|${rec.group_code}`;
      if (!buckets.has(key)) buckets.set(key, new Map());
      buckets.get(key).set(String(rec.source_table), rec);
    }
  }

  const fallbackOrder = ['7060', '1419', '2938'];
  const final = [];

  for (const [key, bySource] of buckets) {
    const date = key.split('|')[0];
    const pref = preferredSource(date);
    let rec = bySource.get(pref);
    if (!rec) {
      for (const id of fallbackOrder) {
        if (bySource.has(id)) {
          rec = bySource.get(id);
          break;
        }
      }
    }
    if (!rec) rec = bySource.values().next().value;
    if (rec) final.push(rec);
  }

  final.sort(
    (a, b) => a.date.localeCompare(b.date) || a.group_code - b.group_code
  );
  return final;
}

function validateMissingMonths(records) {
  if (!records.length) return;

  const dates = [...new Set(records.map((r) => r.date))].sort();
  const min = dates[0];
  const max = dates[dates.length - 1];

  // Gera sequência esperada de meses
  const expected = [];
  let [y, m] = min.split('-').map(Number);
  const [yMax, mMax] = max.split('-').map(Number);
  while (y < yMax || (y === yMax && m <= mMax)) {
    expected.push(`${y}-${String(m).padStart(2, '0')}-01`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  const byGroup = new Map();
  for (const rec of records) {
    if (!byGroup.has(rec.group_code)) byGroup.set(rec.group_code, new Set());
    byGroup.get(rec.group_code).add(rec.date);
  }

  console.log('\n========== Validação de meses faltantes ==========');
  let any = false;
  for (const g of CANONICAL_GROUPS) {
    const set = byGroup.get(g.code) || new Set();
    const missing = expected.filter((d) => !set.has(d));
    if (missing.length) {
      any = true;
      console.warn(
        `⚠ Grupo ${g.code} (${g.shortName}): ${missing.length} mês(es) faltando. ` +
          `Ex.: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`
      );
    } else {
      console.log(`✓ Grupo ${g.code} (${g.shortName}): ${set.size} meses completos`);
    }
  }
  if (!any) console.log('Nenhum mês faltante por grupo no intervalo coberto.');
}

function writeUnifiedCsv(records) {
  const header = [
    'date',
    'year',
    'month',
    'group_code',
    'group_name',
    'short_name',
    'monthly_variation',
    'source_table',
  ];

  const lines = [header.join(',')];
  for (const r of records) {
    // monthly_variation com ponto decimal estável
    const mv =
      typeof r.monthly_variation === 'number'
        ? String(r.monthly_variation)
        : r.monthly_variation;
    // Escape names with commas
    const gname = r.group_name.includes(',') ? `"${r.group_name}"` : r.group_name;
    const sname = r.short_name.includes(',') ? `"${r.short_name}"` : r.short_name;
    lines.push(
      [
        r.date,
        r.year,
        r.month,
        r.group_code,
        gname,
        sname,
        mv,
        r.source_table,
      ].join(',')
    );
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, lines.join('\n') + '\n', 'utf8');
}

function main() {
  console.log('Cidade da Inflação — build do dataset unificado IPCA\n');
  console.log(
    'Fontes:',
    SOURCES.map((s) => `${s.id} (${s.label})`).join(' · ')
  );

  const datasets = [];
  for (const src of SOURCES) {
    if (!fs.existsSync(src.file)) {
      throw new Error(
        `Arquivo não encontrado: ${src.file}\n` +
          `Coloque tabela${src.id}.csv em public/data/ e rode npm run build:data.`
      );
    }
    datasets.push(parseSidraFile(src.file, src.id));
  }

  const merged = mergeDatasets(datasets);

  console.log('\n========== Dataset unificado ==========');
  for (const ds of datasets) {
    console.log(
      `Tabela ${ds.records[0]?.source_table || '?'}: ` +
        `linhas arquivo=${ds.rawLines}, normalizadas=${ds.records.length}, ` +
        `datas ${ds.minDate} → ${ds.maxDate}, grupos [${ds.groups.join(', ')}]`
    );
  }
  console.log(`Quantidade final de linhas: ${merged.length}`);
  if (merged.length) {
    console.log(`Menor data final: ${merged[0].date}`);
    console.log(`Maior data final: ${merged[merged.length - 1].date}`);
  }

  // Contagem por source_table no resultado
  const bySrc = {};
  for (const r of merged) {
    bySrc[r.source_table] = (bySrc[r.source_table] || 0) + 1;
  }
  console.log('Linhas finais por source_table:', bySrc);

  validateMissingMonths(merged);
  writeUnifiedCsv(merged);

  console.log(`\n✓ Escrito: ${OUTPUT}`);
  console.log(`  (${merged.length} linhas de dados + cabeçalho)`);

  const nGroups = new Set(merged.map((r) => r.group_code)).size;
  const nMonths = new Set(merged.map((r) => r.date)).size;
  console.log(
    `  ${nGroups} grupos × ${nMonths} meses ≈ ${nGroups * nMonths} (esperado se completo)`
  );
}

main();
