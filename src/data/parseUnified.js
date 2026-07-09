/**
 * Parser do CSV unificado gerado por `npm run build:data`.
 *
 * Colunas estáveis:
 * date, year, month, group_code, group_name, short_name,
 * monthly_variation, source_table
 */

import Papa from 'papaparse';
import { IPCA_GROUPS } from './groups.js';

/**
 * Converte o CSV unificado no formato usado pela cena 3D.
 * @returns {{
 *   groups: Record<number, object>,
 *   periods: string[],
 *   meta: object
 * }}
 */
export function parseUnifiedCsv(csvText) {
  if (!csvText || !String(csvText).trim()) {
    throw new Error('CSV unificado vazio.');
  }

  const text = String(csvText).replace(/^\uFEFF/, '');
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (!parsed.data?.length) {
    throw new Error('CSV unificado sem linhas de dados.');
  }

  const headers = parsed.meta?.fields || Object.keys(parsed.data[0] || {});
  console.info('[parseUnified] Colunas:', headers);

  // Mapeia colunas por nome aproximado (defensivo)
  const fieldMap = mapFields(headers);

  const groups = {};
  for (const meta of IPCA_GROUPS) {
    groups[meta.id] = {
      ...meta,
      series: [],
      sourceLabel: meta.fullName,
    };
  }

  const seriesMaps = {};
  for (const meta of IPCA_GROUPS) {
    seriesMaps[meta.id] = new Map();
  }

  let rowCount = 0;
  for (const row of parsed.data) {
    const code = Number(row[fieldMap.group_code]);
    if (!code || code < 1 || code > 9) continue;

    const dateKey = toDateKey(row[fieldMap.date], row[fieldMap.year], row[fieldMap.month]);
    if (!dateKey) continue;

    const monthly = parseNumber(row[fieldMap.monthly_variation]);
    if (monthly == null) continue;

    if (!seriesMaps[code]) continue;
    seriesMaps[code].set(dateKey, {
      dateKey,
      monthly,
      weight: null,
      source: row[fieldMap.source_table] || null,
    });
    rowCount++;
  }

  const allPeriods = new Set();
  for (const meta of IPCA_GROUPS) {
    const series = Array.from(seriesMaps[meta.id].values()).sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey)
    );
    groups[meta.id].series = series;
    for (const p of series) allPeriods.add(p.dateKey);
  }

  const periods = Array.from(allPeriods).sort();

  return {
    groups,
    periods,
    meta: {
      format: 'unified',
      rows: rowCount,
      periods: periods.length,
      minDate: periods[0] || null,
      maxDate: periods[periods.length - 1] || null,
      groupsFound: IPCA_GROUPS.filter((g) => groups[g.id].series.length).length,
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

  function find(...candidates) {
    for (const c of candidates) {
      const hit = norm.find((h) => h.n === c || h.n.includes(c));
      if (hit) return hit.raw;
    }
    return null;
  }

  return {
    date: find('date', 'data') || headers[0],
    year: find('year', 'ano'),
    month: find('month', 'mes'),
    group_code: find('group_code', 'codigo', 'group code') || 'group_code',
    group_name: find('group_name', 'group name'),
    short_name: find('short_name', 'short name'),
    monthly_variation: find('monthly_variation', 'variacao', 'monthly') || 'monthly_variation',
    source_table: find('source_table', 'source', 'tabela'),
  };
}

function toDateKey(date, year, month) {
  if (date) {
    const s = String(date).trim();
    // YYYY-MM-01 or YYYY-MM-DD → YYYY-MM
    const m = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
    if (m) return `${m[1]}-${m[2]}`;
    // YYYYMM
    const m2 = s.match(/^(\d{4})(\d{2})$/);
    if (m2) return `${m2[1]}-${m2[2]}`;
  }
  if (year && month) {
    const y = Number(year);
    const mo = Number(month);
    if (y && mo >= 1 && mo <= 12) {
      return `${y}-${String(mo).padStart(2, '0')}`;
    }
  }
  return null;
}

function parseNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim().replace(/%/g, '').replace(/\s/g, '');
  if (!s || s === '...' || s === '-' || s === '..') return null;
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
