export type EntityId = number & { readonly __brand: 'EntityId' };

export type TestEntity = {
  id: EntityId;
  x: number;
  y: number;
};

export type World = {
  testEntity: TestEntity;
  simTimeMs: number;
};

export function createWorld(): World {
  return {
    testEntity: {
      id: 1 as EntityId,
      x: 0,
      y: 0
    },
    simTimeMs: 0
  };
}

const ORBIT_RADIUS = 0.6;
const ORBIT_PERIOD_SEC = 4;

export function updateWorld(world: World, simTimeMs: number): void {
  world.simTimeMs = simTimeMs;
  const t = (simTimeMs / 1000) * ((2 * Math.PI) / ORBIT_PERIOD_SEC);
  world.testEntity.x = Math.cos(t) * ORBIT_RADIUS;
  world.testEntity.y = Math.sin(t) * ORBIT_RADIUS;
}
