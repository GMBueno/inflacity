/**
 * Parser do CSV unificado de produtos selecionados
 * (gerado por npm run build:data).
 *
 * Colunas:
 * date, year, month, product_code, product_name, short_name,
 * monthly_variation, source_table, theme
 */

import Papa from 'papaparse';
import { SELECTED_PRODUCTS, matchProduct } from './products.js';

export function parseProductsUnifiedCsv(csvText) {
  if (!csvText || !String(csvText).trim()) {
    throw new Error('CSV de selecionados vazio.');
  }

  const text = String(csvText).replace(/^\uFEFF/, '');
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (!parsed.data?.length) {
    throw new Error('CSV de selecionados sem linhas.');
  }

  const headers = parsed.meta?.fields || Object.keys(parsed.data[0] || {});
  console.info('[parseProducts] Colunas:', headers);

  const field = mapFields(headers);
  const seriesMaps = new Map();
  const metaByCode = new Map(SELECTED_PRODUCTS.map((p) => [p.code, { ...p }]));

  let rowCount = 0;
  for (const row of parsed.data) {
    const code = String(row[field.product_code] || '').trim();
    if (!code) continue;

    const dateKey = toDateKey(row[field.date], row[field.year], row[field.month]);
    if (!dateKey) continue;

    const monthly = parseNumber(row[field.monthly_variation]);
    if (monthly == null) continue;

    if (!metaByCode.has(code)) {
      const name = row[field.product_name] || code;
      const shortName = row[field.short_name] || name;
      const theme = row[field.theme] || 'default';
      metaByCode.set(code, {
        code,
        fullName: name,
        shortName,
        theme,
        color: row.color || '#94a3b8',
        emissive: '#475569',
        dynamic: true,
      });
    }

    if (!seriesMaps.has(code)) seriesMaps.set(code, new Map());
    seriesMaps.get(code).set(dateKey, {
      dateKey,
      monthly,
      weight: null,
      source: row[field.source_table] || null,
    });
    rowCount++;
  }

  // Ordem canônica + extras dinâmicos
  const codes = [
    ...SELECTED_PRODUCTS.map((p) => p.code),
    ...[...metaByCode.keys()].filter((c) => !SELECTED_PRODUCTS.some((p) => p.code === c)),
  ];

  const products = {};
  const allPeriods = new Set();

  for (const code of codes) {
    const meta = metaByCode.get(code);
    if (!meta) continue;
    const series = Array.from((seriesMaps.get(code) || new Map()).values()).sort(
      (a, b) => a.dateKey.localeCompare(b.dateKey)
    );
    if (!series.length) continue;
    products[code] = {
      ...meta,
      id: code, // compatível com Building (group.id)
      series,
    };
    for (const p of series) allPeriods.add(p.dateKey);
  }

  const periods = Array.from(allPeriods).sort();

  return {
    products,
    periods,
    meta: {
      format: 'products-unified',
      rows: rowCount,
      productsFound: Object.keys(products).length,
      minDate: periods[0] || null,
      maxDate: periods[periods.length - 1] || null,
    },
  };
}

function mapFields(headers) {
  const norm = headers.map((h) => ({
    raw: h,
    n: String(h || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim(),
  }));
  const find = (...cands) => {
    for (const c of cands) {
      const hit = norm.find((h) => h.n === c || h.n.includes(c));
      if (hit) return hit.raw;
    }
    return null;
  };
  return {
    date: find('date', 'data') || headers[0],
    year: find('year', 'ano'),
    month: find('month', 'mes'),
    product_code: find('product_code', 'group_code', 'codigo') || 'product_code',
    product_name: find('product_name', 'group_name', 'nome') || 'product_name',
    short_name: find('short_name') || 'short_name',
    monthly_variation: find('monthly_variation', 'variacao') || 'monthly_variation',
    source_table: find('source_table', 'source'),
    theme: find('theme', 'tema'),
  };
}

function toDateKey(date, year, month) {
  if (date) {
    const s = String(date).trim();
    const m = s.match(/^(\d{4})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}`;
  }
  if (year && month) {
    const y = Number(year);
    const mo = Number(month);
    if (y && mo >= 1 && mo <= 12) return `${y}-${String(mo).padStart(2, '0')}`;
  }
  return null;
}

function parseNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim().replace(/%/g, '').replace(/\s/g, '');
  if (!s || s === '...' || s === '-') return null;
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// re-export for build script convenience
export { matchProduct };
