import { log } from '../log';
import { SIM_STEP_MS } from '../timing';

import { DROP_ARCHETYPES, type DropArchetype } from './drops';
import * as generatedEnemies from './enemies.generated';

export type EnemyBehavior = 'stationary' | 'chase';

export type DropTableEntry = Readonly<{
  archetypeId: string;
  chance: number;
}>;

export type EnemyArchetype = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  maxHp: number;
  behavior: EnemyBehavior;
  maxSpeed: number;
  contactDamage: number;
  contactCooldownMs: number;
  knockbackBaseImpulse: number;
  knockbackVelocityScale: number;
  knockbackDurationMs: number;
  color: number;
  dropTable: ReadonlyArray<DropTableEntry>;
}>;

export * from './enemies.generated';

export const ENEMY_ARCHETYPES: Readonly<Record<string, EnemyArchetype>> =
  createEnemyRegistry(Object.values(generatedEnemies));

function createEnemyRegistry(
  archetypes: ReadonlyArray<EnemyArchetype>
): Readonly<Record<string, EnemyArchetype>> {
  const registry: Record<string, EnemyArchetype> = {};
  for (const archetype of archetypes) {
    if (registry[archetype.id] !== undefined) {
      throw new Error(`duplicate enemy archetype "${archetype.id}"`);
    }
    registry[archetype.id] = archetype;
  }
  return registry;
}

export function validateEnemyRegistry(
  registry: Readonly<Record<string, EnemyArchetype>>,
  playerRadius: number,
  dropRegistry: Readonly<Record<string, DropArchetype>> = DROP_ARCHETYPES
): void {
  for (const archetype of Object.values(registry)) {
    warnIfStationaryInvariantsBroken(archetype);
    warnIfEnemyMayTunnelThroughPlayer(archetype, playerRadius);
    warnIfDropTableInvalid(archetype);
    assertDropTableArchetypesResolve(archetype, dropRegistry);
  }
}

function warnIfStationaryInvariantsBroken(archetype: EnemyArchetype): void {
  if (archetype.behavior !== 'stationary') return;
  const broken =
    archetype.maxSpeed !== 0 ||
    archetype.contactDamage !== 0 ||
    archetype.knockbackBaseImpulse !== 0 ||
    archetype.knockbackVelocityScale !== 0;
  if (!broken) return;
  log.warn("stationary enemy archetype must keep speed/damage/knockback at zero per design/content-archetypes.md", {
    archetypeId: archetype.id,
    maxSpeed: archetype.maxSpeed,
    contactDamage: archetype.contactDamage,
    knockbackBaseImpulse: archetype.knockbackBaseImpulse,
    knockbackVelocityScale: archetype.knockbackVelocityScale
  });
}

function warnIfEnemyMayTunnelThroughPlayer(
  archetype: EnemyArchetype,
  playerRadius: number
): void {
  if (archetype.maxSpeed <= 0) return;
  const stepDistance = archetype.maxSpeed * (SIM_STEP_MS / 1000);
  const reach = archetype.radius + playerRadius;
  if (stepDistance > reach) {
    log.warn('enemy may tunnel through player per design/enemy-contact.md', {
      archetypeId: archetype.id,
      stepDistance,
      reach,
      enemyRadius: archetype.radius,
      playerRadius
    });
  }
}

function warnIfDropTableInvalid(archetype: EnemyArchetype): void {
  let sum = 0;
  for (const entry of archetype.dropTable) {
    if (!(entry.chance >= 0 && entry.chance <= 1)) {
      log.warn('drop table entry chance out of [0, 1] per design/drops.md', {
        enemyArchetypeId: archetype.id,
        dropArchetypeId: entry.archetypeId,
        chance: entry.chance
      });
    }
    sum += entry.chance;
  }
  if (sum > 1 + 1e-9) {
    log.warn('drop table chances sum exceeds 1 per design/drops.md', {
      enemyArchetypeId: archetype.id,
      sum
    });
  }
}

function assertDropTableArchetypesResolve(
  archetype: EnemyArchetype,
  dropRegistry: Readonly<Record<string, DropArchetype>>
): void {
  for (const entry of archetype.dropTable) {
    if (dropRegistry[entry.archetypeId] === undefined) {
      throw new Error(
        `enemy archetype "${archetype.id}" drop table references unknown drop archetype ` +
          `"${entry.archetypeId}" (see design/drops.md and design/content-archetypes.md)`
      );
    }
  }
}
