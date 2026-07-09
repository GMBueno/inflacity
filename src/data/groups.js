/**
 * Metadados dos 9 grandes grupos do IPCA.
 * Cores elegantes para skyline noturno / moderno.
 */
export const IPCA_GROUPS = [
  {
    id: 1,
    fullName: 'Alimentação e bebidas',
    shortName: 'Alimentação',
    match: ['alimentação', 'alimentacao'],
    color: '#f59e0b', // âmbar
    emissive: '#b45309',
  },
  {
    id: 2,
    fullName: 'Habitação',
    shortName: 'Habitação',
    match: ['habitação', 'habitacao'],
    color: '#38bdf8', // sky
    emissive: '#0369a1',
  },
  {
    id: 3,
    fullName: 'Artigos de residência',
    shortName: 'Residência',
    match: ['artigos de residência', 'artigos de residencia', 'residência', 'residencia'],
    color: '#a78bfa', // violeta
    emissive: '#6d28d9',
  },
  {
    id: 4,
    fullName: 'Vestuário',
    shortName: 'Vestuário',
    match: ['vestuário', 'vestuario'],
    color: '#f472b6', // rosa
    emissive: '#be185d',
  },
  {
    id: 5,
    fullName: 'Transportes',
    shortName: 'Transportes',
    match: ['transportes', 'transporte'],
    color: '#34d399', // esmeralda
    emissive: '#047857',
  },
  {
    id: 6,
    fullName: 'Saúde e cuidados pessoais',
    shortName: 'Saúde',
    match: ['saúde', 'saude'],
    color: '#fb7185', // rose
    emissive: '#be123c',
  },
  {
    id: 7,
    fullName: 'Despesas pessoais',
    shortName: 'Pessoais',
    match: ['despesas pessoais'],
    color: '#fbbf24', // amarelo
    emissive: '#b45309',
  },
  {
    id: 8,
    fullName: 'Educação',
    shortName: 'Educação',
    match: ['educação', 'educacao'],
    color: '#60a5fa', // azul
    emissive: '#1d4ed8',
  },
  {
    id: 9,
    fullName: 'Comunicação',
    shortName: 'Comunicação',
    match: ['comunicação', 'comunicacao'],
    color: '#2dd4bf', // teal
    emissive: '#0f766e',
  },
];

/**
 * Posições dos prédios na cidade (grade 3×3 com espaçamento de avenida).
 */
export function getBuildingPositions() {
  const spacing = 5.2;
  const positions = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const i = row * 3 + col;
      positions.push({
        index: i,
        x: (col - 1) * spacing,
        z: (row - 1) * spacing,
      });
    }
  }
  return positions;
}

/**
 * Identifica um grupo IPCA a partir de um rótulo do CSV.
 */
export function matchGroup(label) {
  if (!label) return null;
  const normalized = String(label)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  // Remove prefixo numérico tipo "1." ou "1 -"
  const cleaned = normalized.replace(/^\d+[\.\-\s]+/, '').trim();

  for (const group of IPCA_GROUPS) {
    for (const m of group.match) {
      const mNorm = m
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (cleaned.includes(mNorm) || mNorm.includes(cleaned)) {
        // Evita confusão: "despesas pessoais" vs "cuidados pessoais" (saúde)
        if (mNorm === 'despesas pessoais' && !cleaned.includes('despesas')) {
          continue;
        }
        if (
          (mNorm === 'saude' || mNorm.includes('saude')) &&
          cleaned.includes('despesas pessoais')
        ) {
          continue;
        }
        return group;
      }
    }
  }

  // Tenta pelo número inicial (1–9)
  const numMatch = String(label).match(/^(\d+)\s*[\.\-]/);
  if (numMatch) {
    const id = Number(numMatch[1]);
    return IPCA_GROUPS.find((g) => g.id === id) || null;
  }

  return null;
}
