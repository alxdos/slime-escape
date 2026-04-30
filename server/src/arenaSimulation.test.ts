import { describe, expect, it } from 'vitest';

import { SIM_STEP_MS } from '../../src/shared/timing.js';
import type {
  PublicArenaPlayerId,
  PublicArenaPresentationEvent
} from '../../src/shared/publicArenaProtocol.js';

import {
  PUBLIC_ARENA_BOSS_ARCHETYPE_ID,
  PUBLIC_ARENA_BOSS_LEVEL,
  PUBLIC_ARENA_BOSS_WEAPON_ID,
  PUBLIC_ARENA_INTEREST_HEIGHT_WU,
  PUBLIC_ARENA_REGULAR_WEAPON_ID,
  PUBLIC_ARENA_SPAWN_PROTECTION_MS,
  PUBLIC_ARENA_SLIME_FORM_CHAIN,
  createPublicArenaSimulation
} from './arenaSimulation.js';
import { PUBLIC_ARENA_WORLD_BOUNDS, type PublicArenaMember } from './arenaState.js';

function member(playerId: PublicArenaPlayerId, x: number, y: number): PublicArenaMember {
  return {
    socketId: playerId,
    playerId,
    spawn: { x, y },
    level: 1
  };
}

function playerSnapshot(simulation: ReturnType<typeof createPublicArenaSimulation>, selfId: PublicArenaPlayerId) {
  const snapshot = simulation.snapshotFor(selfId);
  if (snapshot === null) {
    throw new Error(`missing snapshot for ${selfId}`);
  }
  const player = snapshot.players.find((candidate) => candidate.id === selfId);
  if (player === undefined) {
    throw new Error(`missing player ${selfId}`);
  }
  return player;
}

function tickUntilDeath(
  simulation: ReturnType<typeof createPublicArenaSimulation>,
  killerId: PublicArenaPlayerId,
  victimId: PublicArenaPlayerId
) {
  simulation.applyInput(killerId, { kind: 'aim', x: 0.5, y: 0 });
  simulation.applyInput(killerId, { kind: 'fire', phase: 'start' });

  for (let i = 0; i < 3000; i += 1) {
    simulation.tick();
    const events = simulation.drainEvents();
    const death = events.find((event) => event.kind === 'death' && event.playerId === victimId);
    if (death !== undefined) {
      simulation.applyInput(killerId, { kind: 'fire', phase: 'stop' });
      return events;
    }
  }

  throw new Error(`${killerId} did not kill ${victimId}`);
}

function promoteToBoss(
  simulation: ReturnType<typeof createPublicArenaSimulation>,
  killerId: PublicArenaPlayerId,
  victimId: PublicArenaPlayerId
): void {
  while (playerSnapshot(simulation, killerId).level < PUBLIC_ARENA_BOSS_LEVEL) {
    tickUntilDeath(simulation, killerId, victimId);
  }
}

function tickUntilProjectile(
  simulation: ReturnType<typeof createPublicArenaSimulation>,
  selfId: PublicArenaPlayerId,
  weaponArchetypeId: string
) {
  for (let i = 0; i < 120; i += 1) {
    simulation.tick();
    const snapshot = simulation.snapshotFor(selfId);
    const projectiles = snapshot?.projectiles.filter(
      (projectile) => projectile.weaponArchetypeId === weaponArchetypeId
    );
    if (projectiles !== undefined && projectiles.length > 0) {
      return projectiles;
    }
  }
  throw new Error(`no ${weaponArchetypeId} projectile was fired`);
}

function tickUntilHit(
  simulation: ReturnType<typeof createPublicArenaSimulation>
): Extract<PublicArenaPresentationEvent, { kind: 'hit' }> {
  for (let i = 0; i < 120; i += 1) {
    simulation.tick();
    const hit = simulation.drainEvents().find((event) => event.kind === 'hit');
    if (hit !== undefined) {
      return hit;
    }
  }
  throw new Error('no projectile hit was emitted');
}

function expireSpawnProtection(
  simulation: ReturnType<typeof createPublicArenaSimulation>
): void {
  while (simulation.simTimeMs() < PUBLIC_ARENA_SPAWN_PROTECTION_MS) {
    simulation.tick();
    simulation.drainEvents();
  }
}

describe('PublicArenaSimulation', () => {
  it('spawns level 1 slime players and exports authoritative snapshots', () => {
    const simulation = createPublicArenaSimulation();
    simulation.addPlayer(member('player-a', -1, 2));

    const player = playerSnapshot(simulation, 'player-a');

    expect(player).toMatchObject({
      id: 'player-a',
      x: -1,
      y: 2,
      level: 1,
      hp: 2,
      maxHp: 2,
      form: { kind: 'slime', archetypeId: PUBLIC_ARENA_SLIME_FORM_CHAIN[0] }
    });
  });

  it('moves players with normalized intent and clamps them inside the 40 x 40 arena', () => {
    const simulation = createPublicArenaSimulation();
    simulation.addPlayer(member('player-a', -19, -19));
    simulation.applyInput('player-a', { kind: 'move', dx: -1, dy: -1 });

    for (let i = 0; i < 200; i += 1) {
      simulation.tick();
    }

    const player = playerSnapshot(simulation, 'player-a');
    expect(player.x).toBeGreaterThanOrEqual(PUBLIC_ARENA_WORLD_BOUNDS.minX + 0.4);
    expect(player.y).toBeGreaterThanOrEqual(PUBLIC_ARENA_WORLD_BOUNDS.minY + 0.4);
  });

  it('throws rocks, kills a player, gives the killer exactly one level, and resets the victim', () => {
    const simulation = createPublicArenaSimulation();
    simulation.addPlayer(member('killer', 0, 0));
    simulation.addPlayer(member('victim', 0.5, 0));
    simulation.drainEvents();

    const events = tickUntilDeath(simulation, 'killer', 'victim');
    const killer = playerSnapshot(simulation, 'killer');
    const victim = playerSnapshot(simulation, 'victim');

    expect(events.some((event) => event.kind === 'hit' && event.weaponArchetypeId === PUBLIC_ARENA_REGULAR_WEAPON_ID)).toBe(true);
    expect(killer.level).toBe(2);
    expect(killer.form).toEqual({ kind: 'slime', archetypeId: PUBLIC_ARENA_SLIME_FORM_CHAIN[1] });
    expect(victim.level).toBe(1);
    expect(victim.hp).toBe(victim.maxHp);
    expect(victim.x).toBe(0.5);
  });

  it('transforms the final level into the tower boss and fires boss fireballs', () => {
    const simulation = createPublicArenaSimulation();
    simulation.addPlayer(member('killer', 0, 0));
    simulation.addPlayer(member('victim', 0.5, 0));
    simulation.drainEvents();

    promoteToBoss(simulation, 'killer', 'victim');
    const boss = playerSnapshot(simulation, 'killer');
    expect(boss.form).toEqual({ kind: 'boss', archetypeId: PUBLIC_ARENA_BOSS_ARCHETYPE_ID });
    expect(boss.maxHp).toBeGreaterThan(100);

    simulation.removePlayer('victim');
    simulation.applyInput('killer', { kind: 'fire', phase: 'start' });
    const projectiles = tickUntilProjectile(simulation, 'killer', PUBLIC_ARENA_BOSS_WEAPON_ID);

    expect(projectiles).toHaveLength(4);
  });

  it('lets bosses damage other bosses', () => {
    const simulation = createPublicArenaSimulation();
    simulation.addPlayer(member('boss-a', 0, 0));
    simulation.addPlayer(member('boss-b', 1, 0));
    simulation.addPlayer(member('victim', 0.5, 0));
    simulation.drainEvents();

    promoteToBoss(simulation, 'boss-a', 'victim');
    promoteToBoss(simulation, 'boss-b', 'victim');
    const hpBefore = playerSnapshot(simulation, 'boss-b').hp;

    simulation.applyInput('boss-a', { kind: 'fire', phase: 'start' });
    for (let i = 0; i < 120; i += 1) {
      simulation.tick();
    }

    expect(playerSnapshot(simulation, 'boss-b').hp).toBeLessThan(hpBefore);
  });

  it('does not let overlapping burst projectiles kill a respawned player again in the same tick', () => {
    const simulation = createPublicArenaSimulation();
    simulation.addPlayer(member('boss', 0, 0));
    simulation.addPlayer(member('victim', 0.5, 0));
    simulation.drainEvents();

    promoteToBoss(simulation, 'boss', 'victim');
    simulation.applyInput('boss', { kind: 'fire', phase: 'start' });

    for (let i = 0; i < 120; i += 1) {
      simulation.tick();
      const events = simulation.drainEvents();
      const deathCount = events.filter((event) => event.kind === 'death' && event.playerId === 'victim').length;
      if (deathCount > 0) {
        expect(deathCount).toBe(1);
        return;
      }
    }

    throw new Error('boss burst did not kill the victim');
  });

  it('keeps a respawned player safe from later boss bursts during spawn protection', () => {
    const simulation = createPublicArenaSimulation();
    simulation.addPlayer(member('boss', 0, 0));
    simulation.addPlayer(member('victim', 0.5, 0));
    simulation.drainEvents();

    promoteToBoss(simulation, 'boss', 'victim');
    simulation.applyInput('boss', { kind: 'fire', phase: 'start' });

    let respawnedAtSimMs: number | null = null;
    for (let i = 0; i < 240; i += 1) {
      simulation.tick();
      const events = simulation.drainEvents();
      const death = events.find((event) => event.kind === 'death' && event.playerId === 'victim');
      if (death !== undefined) {
        respawnedAtSimMs = simulation.simTimeMs();
        break;
      }
    }
    if (respawnedAtSimMs === null) {
      throw new Error('boss burst did not kill the victim');
    }

    const protectedUntilSimMs = respawnedAtSimMs + PUBLIC_ARENA_SPAWN_PROTECTION_MS;
    while (simulation.simTimeMs() + SIM_STEP_MS < protectedUntilSimMs) {
      simulation.tick();
      const events = simulation.drainEvents();
      expect(events.some((event) => event.kind === 'hit' && event.targetId === 'victim')).toBe(false);
      expect(events.some((event) => event.kind === 'death' && event.playerId === 'victim')).toBe(false);
    }

    const victim = playerSnapshot(simulation, 'victim');
    expect(victim.hp).toBe(victim.maxHp);
    expect(victim.level).toBe(1);
  });

  it('killing a boss advances the killer by exactly one level', () => {
    const simulation = createPublicArenaSimulation();
    simulation.addPlayer(member('killer', 0, 0));
    simulation.addPlayer(member('boss-victim', 0.5, 0));
    simulation.addPlayer(member('fodder', 0.5, 0));
    simulation.drainEvents();

    promoteToBoss(simulation, 'boss-victim', 'fodder');
    const levelBefore = playerSnapshot(simulation, 'killer').level;

    tickUntilDeath(simulation, 'killer', 'boss-victim');

    expect(playerSnapshot(simulation, 'killer').level).toBe(levelBefore + 1);
  });

  it('chooses the nearest overlapping projectile target instead of insertion order', () => {
    const simulation = createPublicArenaSimulation();
    simulation.addPlayer(member('shooter', 0, 0));
    simulation.addPlayer(member('far-target', 0.56, 0));
    simulation.addPlayer(member('near-target', 0.46, 0));
    simulation.drainEvents();
    expireSpawnProtection(simulation);

    simulation.applyInput('shooter', { kind: 'aim', x: 1, y: 0 });
    simulation.applyInput('shooter', { kind: 'fire', phase: 'start' });

    expect(tickUntilHit(simulation).targetId).toBe('near-target');
  });

  it('breaks equal-distance projectile target ties by player id', () => {
    const simulation = createPublicArenaSimulation();
    simulation.addPlayer(member('shooter', 0, 0));
    simulation.addPlayer(member('z-target', 0.5, 0));
    simulation.addPlayer(member('a-target', 0.5, 0));
    simulation.drainEvents();
    expireSpawnProtection(simulation);

    simulation.applyInput('shooter', { kind: 'aim', x: 1, y: 0 });
    simulation.applyInput('shooter', { kind: 'fire', phase: 'start' });

    expect(tickUntilHit(simulation).targetId).toBe('a-target');
  });

  it('filters interest snapshots without changing the authoritative arena snapshot', () => {
    const simulation = createPublicArenaSimulation();
    simulation.addPlayer(member('self', 0, 0));
    simulation.addPlayer(member('nearby', 0, PUBLIC_ARENA_INTEREST_HEIGHT_WU / 2 - 1));
    simulation.addPlayer(member('far-away', 0, PUBLIC_ARENA_WORLD_BOUNDS.maxY - 0.5));

    const fullSnapshot = simulation.snapshotFor('self');
    const interestSnapshot = simulation.interestSnapshotFor('self');

    expect(fullSnapshot?.players.map((player) => player.id).sort()).toEqual(['far-away', 'nearby', 'self']);
    expect(interestSnapshot?.players.map((player) => player.id).sort()).toEqual(['nearby', 'self']);
    expect(fullSnapshot?.population).toBe(3);
    expect(interestSnapshot?.population).toBe(3);
  });
});
