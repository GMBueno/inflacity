/**
 * Gera public/data/ipca_selecionados_unificado.csv a partir de
 * public/data/selecionados/*.csv (exports SIDRA de itens/produtos).
 *
 * Uso: npm run build:data  (encadeado com grupos)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SEL_DIR = path.join(ROOT, 'public', 'data', 'selecionados');
const OUTPUT = path.join(ROOT, 'public', 'data', 'ipca_selecionados_unificado.csv');

const MONTH_PT = {
  janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, outubre: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

// Temas / nomes canônicos (código → meta)
const PRODUCT_META = {
  11: { name: 'Alimentação no domicílio', short: 'Alim. domicílio', theme: 'pantry' },
  1101002: { name: 'Arroz', short: 'Arroz', theme: 'rice' },
  1101052: { name: 'Feijão - preto', short: 'Feijão', theme: 'beans' },
  1102006: { name: 'Macarrão', short: 'Macarrão', theme: 'pasta' },
  1103003: { name: 'Batata-inglesa', short: 'Batata', theme: 'potato' },
  1103028: { name: 'Tomate', short: 'Tomate', theme: 'tomato' },
  1107: { name: 'Carnes', short: 'Carnes', theme: 'meat' },
  1110044: { name: 'Ovo de galinha', short: 'Ovos', theme: 'egg' },
  1111004: { name: 'Leite longa vida', short: 'Leite', theme: 'milk' },
  1112015: { name: 'Pão francês', short: 'Pão', theme: 'bread' },
  1113014: { name: 'Azeite de oliva', short: 'Azeite', theme: 'oil' },
  1114022: { name: 'Café moído', short: 'Café', theme: 'coffee' },
  1114084: { name: 'Cerveja', short: 'Cerveja', theme: 'beer' },
  1114087: { name: 'Vinho', short: 'Vinho', theme: 'wine' },
  1201: { name: 'Alimentação fora do domicílio', short: 'Fora de casa', theme: 'restaurant' },
  2101001: { name: 'Aluguel residencial', short: 'Aluguel', theme: 'rent' },
  2101002: { name: 'Condomínio', short: 'Condomínio', theme: 'condo' },
  2101004: { name: 'Taxa de água e esgoto', short: 'Água/esgoto', theme: 'water' },
  2104008: { name: 'Detergente', short: 'Detergente', theme: 'soap' },
  2201004: { name: 'Gás de botijão', short: 'Gás botijão', theme: 'gas_bottle' },
  2202: { name: 'Energia elétrica residencial', short: 'Energia', theme: 'energy' },
  3202028: { name: 'Computador pessoal', short: 'Computador', theme: 'computer' },
  5101001: { name: 'Ônibus urbano', short: 'Ônibus', theme: 'bus' },
  5101010: { name: 'Passagem aérea', short: 'Aérea', theme: 'plane' },
  5104001: { name: 'Gasolina', short: 'Gasolina', theme: 'gas' },
  5104002: { name: 'Etanol', short: 'Etanol', theme: 'ethanol' },
  5104003: { name: 'Óleo diesel', short: 'Diesel', theme: 'diesel' },
  6203: { name: 'Plano de saúde', short: 'Plano saúde', theme: 'health' },
  7101010: { name: 'Empregado doméstico', short: 'Doméstico', theme: 'domestic' },
  7202041: { name: 'Cigarro', short: 'Cigarro', theme: 'cigarette' },
  8: { name: 'Educação', short: 'Educação', theme: 'education' },
};

function stripAccents(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function normalizeText(s) {
  return stripAccents(String(s || '')).toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeSidraNumber(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim();
  if (!s || ['...', '..', '-', 'X', 'x', 'null', '%', '–', '—'].includes(s)) return null;
  s = s.replace(/%/g, '').replace(/\s/g, '').trim();
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parsePeriodToDate(label) {
  if (label == null || label === '') return null;
  const raw = String(label).trim().toLowerCase();
  let m = raw.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}-01`;
  m = raw.match(/^(\d{4})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-01`;
  m = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${String(Number(m[1])).padStart(2, '0')}-01`;
  m = raw.match(/^([a-záàâãéêíóôõúç]+)\s*[\/\-]?\s*(\d{4})$/i);
  if (m) {
    const mon = MONTH_PT[normalizeText(m[1])] ?? MONTH_PT[m[1]];
    if (mon) return `${m[2]}-${String(mon).padStart(2, '0')}-01`;
  }
  return null;
}

function isMonthlyVariation(text) {
  if (!text) return false;
  const t = normalizeText(text);
  if (t.includes('acumulad') || t.includes('peso')) return false;
  return t.includes('variacao mensal') || (t.includes('variacao') && t.includes('mensal'));
}

function resolveProduct(label) {
  if (!label) return null;
  const raw = String(label).trim();
  if (/^(fonte|notas|legenda|simbolo|símbolo|tabela)/i.test(raw)) return null;
  if (/índice geral|indice geral/i.test(raw)) return null;

  const codeMatch = raw.match(/^(\d+)\s*[\.\-–—]\s*(.+)$/);
  if (!codeMatch) return null;
  const code = codeMatch[1];
  const nameFromLabel = codeMatch[2].trim();
  const meta = PRODUCT_META[code];
  return {
    code,
    name: meta?.name || nameFromLabel,
    short: meta?.short || (nameFromLabel.length > 14 ? nameFromLabel.slice(0, 12) + '…' : nameFromLabel),
    theme: meta?.theme || 'default',
  };
}

function detectDelimiter(sample) {
  const semicolons = (sample.match(/;/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  return semicolons > commas * 1.5 ? ';' : ',';
}

function parseCsvText(text) {
  const clean = String(text).replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(clean.split(/\r?\n/).slice(0, 10).join('\n'));
  const parsed = Papa.parse(clean, { delimiter, skipEmptyLines: false, quoteChar: '"' });
  return parsed.data.map((row) => row.map((c) => (c == null ? '' : String(c).trim())));
}

function parseProductsAsRows(rows, sourceTable) {
  let monthRowIdx = -1;
  let varRowIdx = -1;

  for (let i = 0; i < Math.min(15, rows.length); i++) {
    if (rows[i].filter((c) => parsePeriodToDate(c)).length >= 3 && monthRowIdx < 0) {
      monthRowIdx = i;
    }
  }
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
  const monthAtCol = [];
  let lastMonth = null;
  for (let c = 0; c < Math.max(monthRow.length, varRow.length); c++) {
    const p = parsePeriodToDate(monthRow[c]);
    if (p) lastMonth = p;
    monthAtCol[c] = lastMonth;
  }

  const monthlyCols = [];
  for (let c = 0; c < varRow.length; c++) {
    if (!isMonthlyVariation(varRow[c])) continue;
    if (!monthAtCol[c]) continue;
    monthlyCols.push({ col: c, date: monthAtCol[c] });
  }
  if (monthlyCols.length < 2) return null;

  const records = [];
  let products = 0;
  for (let r = varRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row?.[0]) continue;
    if (/^(fonte|notas|legenda)/i.test(row[0])) break;
    const product = resolveProduct(row[0]);
    if (!product) continue;
    products++;
    for (const { col, date } of monthlyCols) {
      const monthly = normalizeSidraNumber(row[col]);
      if (monthly == null) continue;
      const [y, m] = date.split('-').map(Number);
      records.push({
        date,
        year: y,
        month: m,
        product_code: product.code,
        product_name: product.name,
        short_name: product.short,
        monthly_variation: monthly,
        source_table: String(sourceTable),
        theme: product.theme,
      });
    }
  }
  return { records, products };
}

function sourceIdFromFilename(file) {
  // tabela7060_32_selecionados.csv → 7060
  const m = path.basename(file).match(/(\d{3,5})/);
  return m ? m[1] : path.basename(file, '.csv');
}

function preferredSource(dateIso) {
  const ym = String(dateIso).slice(0, 7);
  if (ym >= '2020-01') return '7060';
  if (ym >= '2012-01') return '1419';
  return '2938';
}

function main() {
  console.log('\nCidade da Inflação — build selecionados\n');

  if (!fs.existsSync(SEL_DIR)) {
    console.warn(`Pasta não encontrada: ${SEL_DIR} — pulando selecionados.`);
    return;
  }

  const files = fs
    .readdirSync(SEL_DIR)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .map((f) => path.join(SEL_DIR, f))
    .sort();

  if (!files.length) {
    console.warn('Nenhum CSV em selecionados/ — pulando.');
    return;
  }

  /** @type {Map<string, Map<string, object>>} */
  const buckets = new Map();
  let totalRaw = 0;

  for (const file of files) {
    const srcId = sourceIdFromFilename(file);
    const rows = parseCsvText(fs.readFileSync(file, 'utf8'));
    const result = parseProductsAsRows(rows, srcId);
    if (!result) {
      console.warn(`Não foi possível parsear: ${file}`);
      continue;
    }
    totalRaw += result.records.length;
    console.log(
      `Arquivo ${path.basename(file)} (source=${srcId}): ` +
        `${result.products} produtos, ${result.records.length} registros`
    );

    for (const rec of result.records) {
      const key = `${rec.date}|${rec.product_code}`;
      if (!buckets.has(key)) buckets.set(key, new Map());
      buckets.get(key).set(rec.source_table, rec);
    }
  }

  const fallback = ['7060', '1419', '2938'];
  const merged = [];
  for (const [key, bySrc] of buckets) {
    const date = key.split('|')[0];
    const pref = preferredSource(date);
    let rec = bySrc.get(pref);
    if (!rec) {
      for (const id of fallback) {
        if (bySrc.has(id)) {
          rec = bySrc.get(id);
          break;
        }
      }
    }
    if (!rec) rec = bySrc.values().next().value;
    if (rec) merged.push(rec);
  }

  merged.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      String(a.product_code).localeCompare(String(b.product_code), undefined, {
        numeric: true,
      })
  );

  const header = [
    'date',
    'year',
    'month',
    'product_code',
    'product_name',
    'short_name',
    'monthly_variation',
    'source_table',
    'theme',
  ];
  const lines = [header.join(',')];
  for (const r of merged) {
    const name = r.product_name.includes(',') ? `"${r.product_name}"` : r.product_name;
    const short = r.short_name.includes(',') ? `"${r.short_name}"` : r.short_name;
    lines.push(
      [
        r.date,
        r.year,
        r.month,
        r.product_code,
        name,
        short,
        r.monthly_variation,
        r.source_table,
        r.theme,
      ].join(',')
    );
  }

  fs.writeFileSync(OUTPUT, lines.join('\n') + '\n', 'utf8');

  const products = new Set(merged.map((r) => r.product_code));
  const dates = [...new Set(merged.map((r) => r.date))].sort();
  console.log(`\n✓ Escrito: ${OUTPUT}`);
  console.log(`  registros brutos: ${totalRaw}`);
  console.log(`  registros finais: ${merged.length}`);
  console.log(`  produtos: ${products.size}`);
  console.log(`  datas: ${dates[0]} → ${dates[dates.length - 1]} (${dates.length} meses)`);
}

main();
