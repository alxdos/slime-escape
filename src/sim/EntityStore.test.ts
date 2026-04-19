import { describe, expect, it } from 'vitest';

import { createEntityStore } from './EntityStore';

const SPEC = {
  position: { x: 1, y: 2 },
  radius: 0.5,
  maxSpeed: 6
};

describe('EntityStore', () => {
  it('starts empty', () => {
    const store = createEntityStore();
    expect(store.player()).toBeNull();
  });

  it('spawns a player matching the spawn spec', () => {
    const store = createEntityStore();
    const player = store.spawnPlayer(SPEC);

    expect(player.position).toEqual(SPEC.position);
    expect(player.radius).toBe(SPEC.radius);
    expect(player.maxSpeed).toBe(SPEC.maxSpeed);
    expect(store.player()).toBe(player);
  });

  it('makes the spawned position independent from the spec object', () => {
    const store = createEntityStore();
    const spec = { position: { x: 0, y: 0 }, radius: 0.5, maxSpeed: 6 };
    const player = store.spawnPlayer(spec);

    spec.position.x = 999;

    expect(player.position.x).toBe(0);
  });

  it('rejects double spawn until cleared', () => {
    const store = createEntityStore();
    store.spawnPlayer(SPEC);
    expect(() => store.spawnPlayer(SPEC)).toThrow();

    store.clear();
    expect(store.player()).toBeNull();
    expect(() => store.spawnPlayer(SPEC)).not.toThrow();
  });
});
