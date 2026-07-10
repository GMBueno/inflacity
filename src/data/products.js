/**
 * Produtos/itens selecionados do IPCA (ilha dos selecionados).
 * `code` = código SIDRA (string). `theme` drive detalhes 3D no prédio.
 */

export const SELECTED_PRODUCTS = [
  { code: '11', fullName: 'Alimentação no domicílio', shortName: 'Alim. domicílio', theme: 'pantry', color: '#fbbf24', emissive: '#b45309' },
  { code: '1101002', fullName: 'Arroz', shortName: 'Arroz', theme: 'rice', color: '#f5f5f4', emissive: '#a8a29e' },
  { code: '1101052', fullName: 'Feijão - preto', shortName: 'Feijão', theme: 'beans', color: '#44403c', emissive: '#1c1917' },
  { code: '1102006', fullName: 'Macarrão', shortName: 'Macarrão', theme: 'pasta', color: '#fde68a', emissive: '#ca8a04' },
  { code: '1103003', fullName: 'Batata-inglesa', shortName: 'Batata', theme: 'potato', color: '#d6b37a', emissive: '#92400e' },
  { code: '1103028', fullName: 'Tomate', shortName: 'Tomate', theme: 'tomato', color: '#ef4444', emissive: '#b91c1c' },
  { code: '1107', fullName: 'Carnes', shortName: 'Carnes', theme: 'meat', color: '#f87171', emissive: '#991b1b' },
  { code: '1110044', fullName: 'Ovo de galinha', shortName: 'Ovos', theme: 'egg', color: '#fef3c7', emissive: '#d97706' },
  { code: '1111004', fullName: 'Leite longa vida', shortName: 'Leite', theme: 'milk', color: '#e0f2fe', emissive: '#7dd3fc' },
  { code: '1112015', fullName: 'Pão francês', shortName: 'Pão', theme: 'bread', color: '#fcd34d', emissive: '#b45309' },
  { code: '1113014', fullName: 'Azeite de oliva', shortName: 'Azeite', theme: 'oil', color: '#a3e635', emissive: '#4d7c0f' },
  { code: '1114022', fullName: 'Café moído', shortName: 'Café', theme: 'coffee', color: '#78350f', emissive: '#451a03' },
  { code: '1114084', fullName: 'Cerveja', shortName: 'Cerveja', theme: 'beer', color: '#f59e0b', emissive: '#b45309' },
  // Vinho removido: sem histórico na tabela antiga (1419)
  { code: '1201', fullName: 'Alimentação fora do domicílio', shortName: 'Fora de casa', theme: 'restaurant', color: '#fb923c', emissive: '#c2410c' },
  { code: '2101001', fullName: 'Aluguel residencial', shortName: 'Aluguel', theme: 'rent', color: '#94a3b8', emissive: '#475569' },
  { code: '2101002', fullName: 'Condomínio', shortName: 'Condomínio', theme: 'condo', color: '#64748b', emissive: '#334155' },
  { code: '2101004', fullName: 'Taxa de água e esgoto', shortName: 'Água/esgoto', theme: 'water', color: '#22d3ee', emissive: '#0e7490' },
  { code: '2104008', fullName: 'Detergente', shortName: 'Detergente', theme: 'soap', color: '#67e8f9', emissive: '#0891b2' },
  { code: '2201004', fullName: 'Gás de botijão', shortName: 'Gás botijão', theme: 'gas_bottle', color: '#f97316', emissive: '#c2410c' },
  { code: '2202', fullName: 'Energia elétrica residencial', shortName: 'Energia', theme: 'energy', color: '#38bdf8', emissive: '#0284c7' },
  { code: '3202028', fullName: 'Computador pessoal', shortName: 'Computador', theme: 'computer', color: '#a1a1aa', emissive: '#52525b' },
  { code: '5101001', fullName: 'Ônibus urbano', shortName: 'Ônibus', theme: 'bus', color: '#facc15', emissive: '#a16207' },
  { code: '5101010', fullName: 'Passagem aérea', shortName: 'Aérea', theme: 'plane', color: '#93c5fd', emissive: '#1d4ed8' },
  { code: '5104001', fullName: 'Gasolina', shortName: 'Gasolina', theme: 'gas', color: '#ea580c', emissive: '#9a3412' },
  { code: '5104002', fullName: 'Etanol', shortName: 'Etanol', theme: 'ethanol', color: '#84cc16', emissive: '#4d7c0f' },
  { code: '5104003', fullName: 'Óleo diesel', shortName: 'Diesel', theme: 'diesel', color: '#57534e', emissive: '#292524' },
  { code: '6203', fullName: 'Plano de saúde', shortName: 'Plano saúde', theme: 'health', color: '#fb7185', emissive: '#be123c' },
  { code: '7101010', fullName: 'Empregado doméstico', shortName: 'Doméstico', theme: 'domestic', color: '#c4b5fd', emissive: '#6d28d9' },
  { code: '7202041', fullName: 'Cigarro', shortName: 'Cigarro', theme: 'cigarette', color: '#a8a29e', emissive: '#57534e' },
  { code: '8', fullName: 'Educação', shortName: 'Educação', theme: 'education', color: '#60a5fa', emissive: '#1d4ed8' },
];

const byCode = new Map(SELECTED_PRODUCTS.map((p) => [p.code, p]));

/**
 * Resolve produto a partir do rótulo SIDRA ("1101002.Arroz").
 * Prefere código; fallback por nome.
 */
export function matchProduct(label) {
  if (!label) return null;
  const raw = String(label).trim();
  if (/^índice geral$/i.test(raw) || /^indice geral$/i.test(raw)) return null;
  if (/^(fonte|notas|legenda)/i.test(raw)) return null;

  const codeMatch = raw.match(/^(\d+)\s*[\.\-–—]\s*(.+)$/);
  if (codeMatch) {
    const code = codeMatch[1];
    if (byCode.has(code)) {
      return { ...byCode.get(code), sourceLabel: raw };
    }
    // Código desconhecido: cria meta genérica a partir do nome
    const name = codeMatch[2].trim();
    return {
      code,
      fullName: name,
      shortName: shorten(name),
      theme: inferTheme(name),
      color: hashColor(code),
      emissive: hashColor(code),
      sourceLabel: raw,
      dynamic: true,
    };
  }

  // Fallback nome
  const norm = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  for (const p of SELECTED_PRODUCTS) {
    const pn = p.fullName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (norm.includes(pn) || pn.includes(norm)) return { ...p, sourceLabel: raw };
  }
  return null;
}

function shorten(name) {
  if (name.length <= 14) return name;
  return name.slice(0, 12) + '…';
}

function inferTheme(name) {
  const n = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (n.includes('arroz')) return 'rice';
  if (n.includes('feijao')) return 'beans';
  if (n.includes('energia') || n.includes('eletr')) return 'energy';
  if (n.includes('gasolina')) return 'gas';
  if (n.includes('etanol')) return 'ethanol';
  if (n.includes('diesel')) return 'diesel';
  if (n.includes('cafe')) return 'coffee';
  if (n.includes('leite')) return 'milk';
  if (n.includes('pao')) return 'bread';
  if (n.includes('tomate')) return 'tomato';
  if (n.includes('carne')) return 'meat';
  if (n.includes('aerea') || n.includes('avi')) return 'plane';
  if (n.includes('onibus')) return 'bus';
  if (n.includes('comput')) return 'computer';
  if (n.includes('saude') || n.includes('plano')) return 'health';
  if (n.includes('educ')) return 'education';
  if (n.includes('cerveja')) return 'beer';
  if (n.includes('vinho')) return 'wine';
  if (n.includes('agua')) return 'water';
  if (n.includes('gas')) return 'gas_bottle';
  return 'default';
}

function hashColor(code) {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 65% 55%)`;
}

/**
 * Grade urbana para N prédios com avenidas entre quarteirões.
 * cols padrão 5 → ruas mais largas e leitura de “cidade”.
 */
export function getProductPositions(count, cols = 5, spacing = 7.2) {
  const positions = [];
  const rows = Math.ceil(count / cols);
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    // leve jitter de quarteirão para não parecer grade militar
    const jx = ((i * 17) % 5) * 0.08 - 0.16;
    const jz = ((i * 13) % 5) * 0.08 - 0.16;
    positions.push({
      index: i,
      x: (col - (cols - 1) / 2) * spacing + jx,
      z: (row - (rows - 1) / 2) * spacing + jz,
    });
  }
  return positions;
}
