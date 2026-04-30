import { describe, expect, it } from 'vitest';

import { SIM_STEP_MS } from '../../src/shared/timing.js';
import { PUBLIC_ARENA_PLAYER } from '../../src/shared/content/publicArena.js';
import {
  BOMB_PLACER,
  GRENADE_LAUNCHER,
  ROCK_THROWER,
  SMG,
  SNIPER
} from '../../src/shared/content/weapons.generated.js';
import * as GENERATED_WEAPONS from '../../src/shared/content/weapons.generated.js';
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
  const shooter = playerSnapshot(simulation, killerId);
  const victim = playerSnapshot(simulation, victimId);
  const aim =
    shooter.x === victim.x && shooter.y === victim.y
      ? { x: victim.x + 1, y: victim.y }
      : { x: victim.x, y: victim.y };
  simulation.applyInput(killerId, { kind: 'aim', x: aim.x, y: aim.y });
  simulation.applyInput(killerId, { kind: 'fire', phase: 'start' });

  for (let i = 0; i < 3000; i += 1) {
    const currentShooter = playerSnapshot(simulation, killerId);
    const currentVictim = playerSnapshot(simulation, victimId);
    const currentAim =
      currentShooter.x === currentVictim.x && currentShooter.y === currentVictim.y
        ? { x: currentVictim.x + 1, y: currentVictim.y }
        : { x: currentVictim.x, y: currentVictim.y };
    simulation.applyInput(killerId, { kind: 'aim', x: currentAim.x, y: currentAim.y });
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
  promoteToLevel(simulation, killerId, victimId, PUBLIC_ARENA_BOSS_LEVEL);
}

function promoteToLevel(
  simulation: ReturnType<typeof createPublicArenaSimulation>,
  killerId: PublicArenaPlayerId,
  victimId: PublicArenaPlayerId,
  targetLevel: number
): void {
  while (playerSnapshot(simulation, killerId).level < targetLevel) {
    tickUntilDeath(simulation, killerId, victimId);
  }
}

function createProgressionSimulation(): ReturnType<typeof createPublicArenaSimulation> {
  return createPublicArenaSimulation({ regularWeaponId: SMG.id });
}

function aimPlayerAt(
  simulation: ReturnType<typeof createPublicArenaSimulation>,
  playerId: PublicArenaPlayerId,
  targetId: PublicArenaPlayerId
): void {
  const target = playerSnapshot(simulation, targetId);
  simulation.applyInput(playerId, { kind: 'aim', x: target.x, y: target.y });
}

function steerPlayerToward(
  simulation: ReturnType<typeof createPublicArenaSimulation>,
  playerId: PublicArenaPlayerId,
  targetId: PublicArenaPlayerId
): void {
  const player = playerSnapshot(simulation, playerId);
  const target = playerSnapshot(simulation, targetId);
  simulation.applyInput(playerId, {
    kind: 'move',
    dx: target.x - player.x,
    dy: target.y - player.y
  });
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

function tickUntilExplosion(
  simulation: ReturnType<typeof createPublicArenaSimulation>
): Extract<PublicArenaPresentationEvent, { kind: 'explosion' }> {
  for (let i = 0; i < 360; i += 1) {
    simulation.tick();
    const explosion = simulation.drainEvents().find((event) => event.kind === 'explosion');
    if (explosion !== undefined) {
      return explosion;
    }
  }
  throw new Error('no projectile explosion was emitted');
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
      hp: PUBLIC_ARENA_PLAYER.maxHp,
      maxHp: PUBLIC_ARENA_PLAYER.maxHp,
      form: { kind: 'slime', archetypeId: PUBLIC_ARENA_SLIME_FORM_CHAIN[0] }
    });
  });

  it('moves players with normalized intent and clamps them inside the generated arena bounds', () => {
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

  it('uses the generated portal player movement speed', () => {
    const simulation = createPublicArenaSimulation();
    simulation.addPlayer(member('player-a', 0, 0));
    simulation.applyInput('player-a', { kind: 'move', dx: 1, dy: 0 });

    simulation.tick();

    expect(playerSnapshot(simulation, 'player-a').x).toBeCloseTo(
      (PUBLIC_ARENA_PLAYER.maxSpeed * SIM_STEP_MS) / 1000
    );
  });

  it('uses the generated rock thrower projectile size and damage', () => {
    const simulation = createPublicArenaSimulation();
    simulation.addPlayer(member('killer', 0, 0));
    simulation.addPlayer(member('victim', 0.5, 0));
    simulation.drainEvents();
    expireSpawnProtection(simulation);
    const hpBefore = playerSnapshot(simulation, 'victim').hp;

    simulation.applyInput('killer', { kind: 'aim', x: 0.5, y: 0 });
    simulation.applyInput('killer', { kind: 'fire', phase: 'start' });
    const projectiles = tickUntilProjectile(
      simulation,
      'killer',
      PUBLIC_ARENA_REGULAR_WEAPON_ID
    );
    const hit = tickUntilHit(simulation);

    expect(projectiles[0]?.size).toEqual(ROCK_THROWER.projectile.size);
    expect(hit.ownerId).toBe('killer');
    expect(hit.ownerKind).toBe('player');
    expect(hit.targetForm).toEqual({
      kind: 'slime',
      archetypeId: PUBLIC_ARENA_SLIME_FORM_CHAIN[0]
    });
    expect(hit.damage).toBe(ROCK_THROWER.projectile.impactDamage);
    expect(hpBefore - playerSnapshot(simulation, 'victim').hp).toBe(
      ROCK_THROWER.projectile.impactDamage
    );
  });

  it('applies generated projectile knockback impulse to hit players', () => {
    const simulation = createPublicArenaSimulation({ regularWeaponId: ROCK_THROWER.id });
    simulation.addPlayer(member('shooter', 0, 0));
    simulation.addPlayer(member('victim', 0.5, 0));
    simulation.drainEvents();
    expireSpawnProtection(simulation);
    const victimXBefore = playerSnapshot(simulation, 'victim').x;

    simulation.applyInput('shooter', { kind: 'aim', x: 1, y: 0 });
    simulation.applyInput('shooter', { kind: 'fire', phase: 'start' });
    tickUntilHit(simulation);
    simulation.tick();

    expect(playerSnapshot(simulation, 'victim').x).toBeGreaterThan(victimXBefore);
  });

  it('can fire every generated regular weapon id without weapon-specific arena code', () => {
    for (const weapon of Object.values(GENERATED_WEAPONS)) {
      const simulation = createPublicArenaSimulation({ regularWeaponId: weapon.id });
      simulation.addPlayer(member('shooter', 0, 0));
      simulation.drainEvents();

      simulation.applyInput('shooter', { kind: 'aim', x: 3, y: 0 });
      simulation.applyInput('shooter', { kind: 'fire', phase: 'start' });
      const projectiles = tickUntilProjectile(simulation, 'shooter', weapon.id);
      const fireEvent = simulation.drainEvents().find((event) => event.kind === 'fire');

      expect(projectiles.length).toBeGreaterThan(0);
      expect(projectiles[0]?.weaponArchetypeId).toBe(weapon.id);
      expect(projectiles[0]?.size).toEqual(weapon.projectile.size);
      expect(fireEvent).toMatchObject({
        kind: 'fire',
        shooterId: 'shooter',
        weaponArchetypeId: weapon.id
      });
    }
  });

  it('exports arc and grounded projectile presentation state from generated weapon content', () => {
    const simulation = createPublicArenaSimulation({ regularWeaponId: GRENADE_LAUNCHER.id });
    simulation.addPlayer(member('shooter', 0, 0));
    simulation.drainEvents();

    simulation.applyInput('shooter', { kind: 'aim', x: 6, y: 0 });
    simulation.applyInput('shooter', { kind: 'fire', phase: 'start' });
    const flying = tickUntilProjectile(simulation, 'shooter', GRENADE_LAUNCHER.id)[0];

    expect(flying?.state).toBe('flying');
    expect(flying?.arcEnd).toEqual({ x: GRENADE_LAUNCHER.projectile.motion.range, y: 0 });
    expect(flying?.visualState.spinRadians).toBeGreaterThan(0);

    for (let i = 0; i < 80; i += 1) {
      simulation.tick();
      simulation.drainEvents();
    }
    const grounded = simulation.snapshotFor('shooter')?.projectiles.find(
      (projectile) => projectile.weaponArchetypeId === GRENADE_LAUNCHER.id
    );

    expect(grounded?.state).toBe('grounded');
    expect(grounded?.arcEnd).toBeNull();
    expect(grounded?.explosionRadius).toBe(GRENADE_LAUNCHER.projectile.explosion?.radius);
    expect(grounded?.detonateAtSimMs).not.toBeNull();
  });

  it('supports placed explosive weapons from generated content', () => {
    const simulation = createPublicArenaSimulation({ regularWeaponId: BOMB_PLACER.id });
    simulation.addPlayer(member('shooter', 0, 0));
    simulation.addPlayer(member('victim', 1, 0));
    simulation.drainEvents();
    expireSpawnProtection(simulation);
    const hpBefore = playerSnapshot(simulation, 'victim').hp;

    simulation.applyInput('shooter', { kind: 'fire', phase: 'start' });
    const placed = tickUntilProjectile(simulation, 'shooter', BOMB_PLACER.id)[0];
    const explosion = tickUntilExplosion(simulation);

    expect(placed?.state).toBe('grounded');
    expect(placed?.detonateAtSimMs).not.toBeNull();
    expect(explosion.weaponArchetypeId).toBe(BOMB_PLACER.id);
    expect(hpBefore - playerSnapshot(simulation, 'victim').hp).toBe(
      BOMB_PLACER.projectile.explosion?.damage
    );
  });

  it('applies generated pierce counts to linear weapons', () => {
    const simulation = createPublicArenaSimulation({ regularWeaponId: SNIPER.id });
    simulation.addPlayer(member('shooter', 0, 0));
    simulation.addPlayer(member('near-victim', 0.5, 0));
    simulation.addPlayer(member('far-victim', 1, 0));
    simulation.drainEvents();
    expireSpawnProtection(simulation);

    simulation.applyInput('shooter', { kind: 'aim', x: 2, y: 0 });
    simulation.applyInput('shooter', { kind: 'fire', phase: 'start' });

    const hits: PublicArenaPresentationEvent[] = [];
    for (let i = 0; i < 120; i += 1) {
      simulation.tick();
      hits.push(...simulation.drainEvents().filter((event) => event.kind === 'hit'));
      if (hits.length >= 2) {
        break;
      }
    }

    expect(hits.map((event) => (event.kind === 'hit' ? event.targetId : null))).toEqual([
      'near-victim',
      'far-victim'
    ]);
  });

  it('throws rocks, kills a player, gives the killer exactly one level, and resets the victim', () => {
    const simulation = createPublicArenaSimulation();
    const victimSpawnX = PUBLIC_ARENA_WORLD_BOUNDS.maxX - 1;
    const killerSpawnX = victimSpawnX - 1;
    simulation.addPlayer(member('killer', killerSpawnX, 0));
    simulation.addPlayer(member('victim', victimSpawnX, 0));
    simulation.drainEvents();

    const events = tickUntilDeath(simulation, 'killer', 'victim');
    const killer = playerSnapshot(simulation, 'killer');
    const victim = playerSnapshot(simulation, 'victim');
    const death = events.find((event) => event.kind === 'death');

    expect(events.some((event) => event.kind === 'hit' && event.weaponArchetypeId === PUBLIC_ARENA_REGULAR_WEAPON_ID)).toBe(true);
    expect(death).toMatchObject({
      playerId: 'victim',
      form: { kind: 'slime', archetypeId: PUBLIC_ARENA_SLIME_FORM_CHAIN[0] }
    });
    expect(killer.level).toBe(2);
    expect(killer.form).toEqual({ kind: 'slime', archetypeId: PUBLIC_ARENA_SLIME_FORM_CHAIN[1] });
    expect(victim.level).toBe(1);
    expect(victim.hp).toBe(victim.maxHp);
    expect(victim.x).toBe(victimSpawnX);
  });

  it('transforms the final level into the tower boss and fires boss fireballs', () => {
    const simulation = createProgressionSimulation();
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

  it('walks through the final authored slime before transforming into the boss', () => {
    const simulation = createProgressionSimulation();
    simulation.addPlayer(member('killer', 0, 0));
    simulation.addPlayer(member('victim', 0.5, 0));
    simulation.drainEvents();

    const finalSlimeId = PUBLIC_ARENA_SLIME_FORM_CHAIN.at(-1);
    if (finalSlimeId === undefined) {
      throw new Error('public arena slime chain must not be empty');
    }

    promoteToLevel(simulation, 'killer', 'victim', PUBLIC_ARENA_BOSS_LEVEL - 1);
    expect(playerSnapshot(simulation, 'killer').form).toEqual({
      kind: 'slime',
      archetypeId: finalSlimeId
    });

    tickUntilDeath(simulation, 'killer', 'victim');
    expect(playerSnapshot(simulation, 'killer').form).toEqual({
      kind: 'boss',
      archetypeId: PUBLIC_ARENA_BOSS_ARCHETYPE_ID
    });
  });

  it('lets bosses damage other bosses', () => {
    const simulation = createProgressionSimulation();
    simulation.addPlayer(member('boss-a', 0, -4));
    simulation.addPlayer(member('boss-b', 0, 4));
    simulation.addPlayer(member('victim-a', 0.5, -4));
    simulation.addPlayer(member('victim-b', 0.5, 4));
    simulation.drainEvents();

    promoteToBoss(simulation, 'boss-a', 'victim-a');
    promoteToBoss(simulation, 'boss-b', 'victim-b');
    const hpBefore = playerSnapshot(simulation, 'boss-b').hp;

    simulation.applyInput('boss-a', { kind: 'fire', phase: 'start' });
    for (let i = 0; i < 120; i += 1) {
      simulation.tick();
    }

    expect(playerSnapshot(simulation, 'boss-b').hp).toBeLessThan(hpBefore);
  });

  it('does not let overlapping burst projectiles kill a respawned player again in the same tick', () => {
    const simulation = createProgressionSimulation();
    simulation.addPlayer(member('boss', 0, 0));
    simulation.addPlayer(member('victim', 0.1, 0.1));
    simulation.drainEvents();

    promoteToBoss(simulation, 'boss', 'victim');
    expireSpawnProtection(simulation);
    simulation.applyInput('boss', { kind: 'fire', phase: 'start' });

    for (let i = 0; i < 900; i += 1) {
      aimPlayerAt(simulation, 'boss', 'victim');
      steerPlayerToward(simulation, 'victim', 'boss');
      simulation.tick();
      const events = simulation.drainEvents();
      const deathCount = events.filter(
        (event) => event.kind === 'death' && event.playerId === 'victim'
      ).length;
      if (deathCount > 0) {
        expect(deathCount).toBe(1);
        return;
      }
    }

    throw new Error('boss burst did not kill the victim');
  });

  it('keeps a respawned player safe from later boss bursts during spawn protection', () => {
    const simulation = createProgressionSimulation();
    simulation.addPlayer(member('boss', 0, 0));
    simulation.addPlayer(member('victim', 0.1, 0.1));
    simulation.drainEvents();

    promoteToBoss(simulation, 'boss', 'victim');
    expireSpawnProtection(simulation);
    simulation.applyInput('boss', { kind: 'fire', phase: 'start' });

    let respawnedAtSimMs: number | null = null;
    for (let i = 0; i < 900; i += 1) {
      aimPlayerAt(simulation, 'boss', 'victim');
      steerPlayerToward(simulation, 'victim', 'boss');
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
    const simulation = createProgressionSimulation();
    simulation.addPlayer(member('killer', 0, 0));
    simulation.addPlayer(member('boss-victim', 0.5, 0));
    simulation.addPlayer(member('fodder', 1, 0));
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
