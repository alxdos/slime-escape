import type { EntityStore, Player } from './EntityStore.js';

export function resolveNearestLivingPlayer(
  store: EntityStore,
  position: Readonly<{ x: number; y: number }>
): Player | null {
  let best: Player | null = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (const player of store.players()) {
    if (player.state !== 'alive' || player.hp <= 0) continue;
    const distanceSq = distanceSquared(position, player.position);
    if (
      best === null ||
      distanceSq < bestDistanceSq ||
      (distanceSq === bestDistanceSq && player.playerId < best.playerId)
    ) {
      best = player;
      bestDistanceSq = distanceSq;
    }
  }
  return best;
}

function distanceSquared(
  a: Readonly<{ x: number; y: number }>,
  b: Readonly<{ x: number; y: number }>
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
