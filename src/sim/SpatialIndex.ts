import type { Boss, Enemy, EntityStore, Player, Projectile } from './EntityStore';

export type IndexedEntity = Player | Enemy | Boss | Projectile;

export type SpatialIndex = Readonly<{
  rebuild(store: EntityStore): void;
  queryRadius(x: number, y: number, radius: number): ReadonlyArray<IndexedEntity>;
  queryAabb(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ): ReadonlyArray<IndexedEntity>;
  size(): number;
}>;

export function createSpatialIndex(): SpatialIndex {
  let entries: IndexedEntity[] = [];

  return {
    rebuild(store): void {
      entries = [];
      const p = store.player();
      if (p !== null) entries.push(p);
      for (const enemy of store.enemies()) entries.push(enemy);
      for (const boss of store.bosses()) entries.push(boss);
      for (const projectile of store.projectiles()) entries.push(projectile);
    },
    queryRadius(x, y, radius): ReadonlyArray<IndexedEntity> {
      const r2 = radius * radius;
      const out: IndexedEntity[] = [];
      for (const entry of entries) {
        const dx = entry.position.x - x;
        const dy = entry.position.y - y;
        if (dx * dx + dy * dy <= r2) out.push(entry);
      }
      return out;
    },
    queryAabb(minX, minY, maxX, maxY): ReadonlyArray<IndexedEntity> {
      const out: IndexedEntity[] = [];
      for (const entry of entries) {
        const px = entry.position.x;
        const py = entry.position.y;
        if (px >= minX && px <= maxX && py >= minY && py <= maxY) out.push(entry);
      }
      return out;
    },
    size(): number {
      return entries.length;
    }
  };
}
