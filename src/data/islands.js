/**
 * Duas cidades separadas por rio.
 * origins = centro da grade de prédios.
 */

export const ISLANDS = {
  groups: {
    id: 'groups',
    name: 'Cidade dos Grupos',
    subtitle: '9 grandes grupos do IPCA',
    origin: { x: -28, z: 0 },
    // Half-size da área urbana (para ruas / detecção)
    halfW: 18,
    halfD: 16,
    accent: '#38bdf8',
    groundColor: '#3d5c3a',
    asphaltColor: '#2a3344',
    // Contorno orgânico da “ilha” (pontos relativos ao origin, no plano XZ)
    // Ordem horária — formato de península / ilha irregular
    shoreline: [
      [-20, -18], [-14, -20], [-6, -19], [2, -17], [10, -18], [16, -14],
      [19, -6], [18, 4], [16, 12], [10, 17], [2, 19], [-6, 18],
      [-14, 17], [-19, 12], [-21, 4], [-20, -6], [-21, -12],
    ],
  },
  selected: {
    id: 'selected',
    name: 'Cidade dos Selecionados',
    subtitle: 'Produtos e serviços em destaque',
    origin: { x: 34, z: 0 },
    halfW: 22,
    halfD: 18,
    accent: '#f59e0b',
    groundColor: '#456b3f',
    asphaltColor: '#2a3344',
    shoreline: [
      [-22, -16], [-12, -20], [-2, -19], [8, -20], [16, -16], [21, -8],
      [23, 0], [22, 10], [16, 17], [6, 20], [-4, 19], [-14, 16],
      [-20, 10], [-23, 2], [-22, -8],
    ],
  },
};

/** Detecta cidade mais próxima de um ponto XZ. */
export function nearestIsland(x, z) {
  let best = ISLANDS.groups;
  let bestD = Infinity;
  for (const island of Object.values(ISLANDS)) {
    const dx = x - island.origin.x;
    const dz = z - island.origin.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD) {
      bestD = d;
      best = island;
    }
  }
  return best;
}
