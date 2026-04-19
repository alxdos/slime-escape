import { describe, expect, it } from 'vitest';

import type { ArenaConfig, PlayerSpawn } from '../shared/session';
import { SIM_STEP_MS } from '../shared/timing';

import { createEntityStore } from './EntityStore';
import { createMovementSystem } from './MovementSystem';
import { createRuntimeInputState } from './RuntimeInputState';

const ARENA: ArenaConfig = { width: 32, height: 18 };
const PLAYER: PlayerSpawn = { position: { x: 0, y: 0 }, radius: 0.5, maxSpeed: 6 };
const SIM_STEP_SEC = SIM_STEP_MS / 1000;

function setup(spec: PlayerSpawn = PLAYER) {
  const store = createEntityStore();
  store.spawnPlayer(spec);
  const movement = createMovementSystem();
  const input = createRuntimeInputState();
  return { store, movement, input };
}

describe('MovementSystem', () => {
  it('does not move the player when moveDir is zero', () => {
    const { store, movement, input } = setup();
    for (let i = 0; i < 10; i += 1) {
      movement.tick(ARENA, store, input);
    }
    expect(store.player()?.position).toEqual({ x: 0, y: 0 });
  });

  it('integrates moveDir at maxSpeed * SIM_STEP_SEC per tick', () => {
    const { store, movement, input } = setup();
    input.moveDir.dx = 1;
    movement.tick(ARENA, store, input);
    expect(store.player()?.position.x).toBeCloseTo(PLAYER.maxSpeed * SIM_STEP_SEC, 10);
    expect(store.player()?.position.y).toBe(0);
  });

  it('treats normalised diagonal as full speed (not sqrt(2)*speed)', () => {
    const { store, movement, input } = setup();
    const inv = Math.SQRT1_2;
    input.moveDir.dx = inv;
    input.moveDir.dy = inv;
    movement.tick(ARENA, store, input);
    const p = store.player();
    expect(p).not.toBeNull();
    if (p === null) throw new Error('unreachable');
    const traveled = Math.hypot(p.position.x, p.position.y);
    expect(traveled).toBeCloseTo(PLAYER.maxSpeed * SIM_STEP_SEC, 10);
  });

  it('keeps the player inside the arena no matter how long it pushes outward (design/arena-and-coordinates.md)', () => {
    const { store, movement, input } = setup();
    const halfW = ARENA.width / 2;
    const halfH = ARENA.height / 2;
    input.moveDir.dx = 1;
    input.moveDir.dy = 1;
    for (let i = 0; i < 10000; i += 1) {
      movement.tick(ARENA, store, input);
    }
    const p = store.player();
    expect(p).not.toBeNull();
    if (p === null) throw new Error('unreachable');
    expect(p.position.x).toBeLessThanOrEqual(halfW - PLAYER.radius);
    expect(p.position.y).toBeLessThanOrEqual(halfH - PLAYER.radius);

    input.moveDir.dx = -1;
    input.moveDir.dy = -1;
    for (let i = 0; i < 10000; i += 1) {
      movement.tick(ARENA, store, input);
    }
    expect(p.position.x).toBeGreaterThanOrEqual(-halfW + PLAYER.radius);
    expect(p.position.y).toBeGreaterThanOrEqual(-halfH + PLAYER.radius);
  });

  it('is a no-op when no player is spawned', () => {
    const store = createEntityStore();
    const movement = createMovementSystem();
    const input = createRuntimeInputState();
    input.moveDir.dx = 1;
    expect(() => movement.tick(ARENA, store, input)).not.toThrow();
    expect(store.player()).toBeNull();
  });
});
