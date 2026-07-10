/**
 * Ilhas do mundo da Cidade da Inflação.
 * Centro da câmera/target padrão = Ilha dos Grupos.
 */

export const ISLANDS = {
  groups: {
    id: 'groups',
    name: 'Ilha dos Grupos',
    subtitle: '9 grandes grupos do IPCA',
    // Centro mundial
    origin: { x: 0, z: 0 },
    // Raio aproximado da plataforma
    radius: 16,
    // Cor de destaque
    accent: '#38bdf8',
    groundColor: '#1a2740',
  },
  selected: {
    id: 'selected',
    name: 'Ilha dos Selecionados',
    subtitle: 'Produtos e serviços em destaque',
    // A leste, do outro lado do rio
    origin: { x: 52, z: 0 },
    radius: 18,
    accent: '#f59e0b',
    groundColor: '#1f2a1a',
  },
};

/** Detecta ilha mais próxima de um ponto XZ. */
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
