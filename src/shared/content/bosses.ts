import * as generatedBosses from './bosses.generated';

export type BossPhaseSpec = Readonly<{
  id: string;
  allowedAttackIds: ReadonlyArray<string>;
  exitWhenHpFractionAtOrBelow: number;
}>;

export type BossAttackSpec = Readonly<{
  pattern: string;
  cooldownMs: number;
  damage: number;
}>;

export type BossArchetype = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  maxHp: number;
  maxSpeed: number;
  color: number;
  contactDamage: number;
  contactCooldownMs: number;
  knockbackBaseImpulse: number;
  knockbackVelocityScale: number;
  knockbackDurationMs: number;
  phases: ReadonlyArray<BossPhaseSpec>;
  attacks: Readonly<Record<string, BossAttackSpec>>;
}>;

export * from './bosses.generated';

export const BOSS_ARCHETYPES: Readonly<Record<string, BossArchetype>> =
  createBossRegistry(Object.values(generatedBosses));

function createBossRegistry(
  archetypes: ReadonlyArray<BossArchetype>
): Readonly<Record<string, BossArchetype>> {
  const registry: Record<string, BossArchetype> = {};
  for (const archetype of archetypes) {
    if (registry[archetype.id] !== undefined) {
      throw new Error(`duplicate boss archetype "${archetype.id}"`);
    }
    registry[archetype.id] = archetype;
  }
  return registry;
}
