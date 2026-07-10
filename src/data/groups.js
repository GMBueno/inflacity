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
    color: '#f59e0b',
    emissive: '#b45309',
    theme: 'pantry',
  },
  {
    id: 2,
    fullName: 'Habitação',
    shortName: 'Habitação',
    match: ['habitação', 'habitacao'],
    color: '#38bdf8',
    emissive: '#0369a1',
    theme: 'house',
  },
  {
    id: 3,
    fullName: 'Artigos de residência',
    shortName: 'Residência',
    match: ['artigos de residência', 'artigos de residencia', 'residência', 'residencia'],
    color: '#a78bfa',
    emissive: '#6d28d9',
    theme: 'condo',
  },
  {
    id: 4,
    fullName: 'Vestuário',
    shortName: 'Vestuário',
    match: ['vestuário', 'vestuario'],
    color: '#f472b6',
    emissive: '#be185d',
    theme: 'default',
  },
  {
    id: 5,
    fullName: 'Transportes',
    shortName: 'Transportes',
    match: ['transportes', 'transporte'],
    color: '#34d399',
    emissive: '#047857',
    theme: 'bus',
  },
  {
    id: 6,
    fullName: 'Saúde e cuidados pessoais',
    shortName: 'Saúde',
    match: ['saúde', 'saude'],
    color: '#fb7185',
    emissive: '#be123c',
    theme: 'health',
  },
  {
    id: 7,
    fullName: 'Despesas pessoais',
    shortName: 'Pessoais',
    match: ['despesas pessoais'],
    color: '#fbbf24',
    emissive: '#b45309',
    theme: 'default',
  },
  {
    id: 8,
    fullName: 'Educação',
    shortName: 'Educação',
    match: ['educação', 'educacao'],
    color: '#60a5fa',
    emissive: '#1d4ed8',
    theme: 'education',
  },
  {
    id: 9,
    fullName: 'Comunicação',
    shortName: 'Comunicação',
    match: ['comunicação', 'comunicacao'],
    color: '#2dd4bf',
    emissive: '#0f766e',
    theme: 'default',
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
