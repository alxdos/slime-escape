import { log } from '../log.js';
import type { ContactBox } from '../session.js';
import { SIM_STEP_MS } from '../timing.js';

import { DROP_ARCHETYPES, type DropArchetype } from './drops.js';
import * as generatedEnemies from './enemies.generated.js';

export type EnemyBehavior = 'stationary' | 'chase';

export type DropTableEntry = Readonly<{
  archetypeId: string;
  chance: number;
}>;

export type RetaliationPolicy = Readonly<{
  enabled: boolean;
  durationMs: number;
}>;

export type EnemyArchetype = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  contactBox: ContactBox;
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
  retaliation: RetaliationPolicy;
}>;

export * from './enemies.generated.js';

export const ENEMY_ARCHETYPES: Readonly<Record<string, EnemyArchetype>> =
  createEnemyRegistry(generatedEnemies.ENEMY_ARCHETYPE_LIST);

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
  playerContactBox: ContactBox,
  dropRegistry: Readonly<Record<string, DropArchetype>> = DROP_ARCHETYPES
): void {
  for (const archetype of Object.values(registry)) {
    warnIfStationaryInvariantsBroken(archetype);
    warnIfEnemyMayTunnelThroughPlayer(archetype, playerContactBox);
    warnIfDropTableInvalid(archetype);
    assertDropTableArchetypesResolve(archetype, dropRegistry);
    warnIfRetaliationInvalid(archetype);
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
  playerContactBox: ContactBox
): void {
  if (archetype.maxSpeed <= 0) return;
  const stepDistance = archetype.maxSpeed * (SIM_STEP_MS / 1000);
  const reachX = (archetype.contactBox.width + playerContactBox.width) / 2;
  const reachY = (archetype.contactBox.height + playerContactBox.height) / 2;
  const reach = Math.min(reachX, reachY);
  if (stepDistance > reach) {
    log.warn('enemy may tunnel through player per design/enemy-contact.md', {
      archetypeId: archetype.id,
      stepDistance,
      reach,
      reachX,
      reachY,
      enemyContactBox: archetype.contactBox,
      playerContactBox
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

function warnIfRetaliationInvalid(archetype: EnemyArchetype): void {
  if (!archetype.retaliation.enabled) return;
  if (archetype.retaliation.durationMs <= 0) {
    log.warn('enabled retaliation duration must be positive per design/combat-modifiers-and-field-effects.md', {
      enemyArchetypeId: archetype.id,
      durationMs: archetype.retaliation.durationMs
    });
  }
}
