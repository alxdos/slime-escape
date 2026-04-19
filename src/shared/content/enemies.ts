import { log } from '../log';
import { SIM_STEP_MS } from '../timing';

export type EnemyBehavior = 'stationary' | 'chase';

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
}>;

export const TRAINING_TARGET: EnemyArchetype = {
  id: 'training-target',
  displayName: 'Training Target',
  radius: 0.6,
  maxHp: 3,
  behavior: 'stationary',
  maxSpeed: 0,
  contactDamage: 0,
  contactCooldownMs: 1,
  knockbackBaseImpulse: 0,
  knockbackVelocityScale: 0,
  knockbackDurationMs: 1,
  color: 0xff7766
};

export const SLIME_FAST: EnemyArchetype = {
  id: 'slime-fast',
  displayName: 'Fast Slime',
  radius: 0.4,
  maxHp: 1,
  behavior: 'chase',
  maxSpeed: 4,
  contactDamage: 1,
  contactCooldownMs: 800,
  knockbackBaseImpulse: 8,
  knockbackVelocityScale: 1.5,
  knockbackDurationMs: 350,
  color: 0x77ff99
};

export const SLIME_TANK: EnemyArchetype = {
  id: 'slime-tank',
  displayName: 'Tank Slime',
  radius: 0.7,
  maxHp: 5,
  behavior: 'chase',
  maxSpeed: 1.8,
  contactDamage: 2,
  contactCooldownMs: 1000,
  knockbackBaseImpulse: 3,
  knockbackVelocityScale: 0.5,
  knockbackDurationMs: 200,
  color: 0x4488dd
};

export const ENEMY_ARCHETYPES: Readonly<Record<string, EnemyArchetype>> = {
  [TRAINING_TARGET.id]: TRAINING_TARGET,
  [SLIME_FAST.id]: SLIME_FAST,
  [SLIME_TANK.id]: SLIME_TANK
};

export function validateEnemyRegistry(
  registry: Readonly<Record<string, EnemyArchetype>>,
  playerRadius: number
): void {
  for (const archetype of Object.values(registry)) {
    warnIfStationaryInvariantsBroken(archetype);
    warnIfEnemyMayTunnelThroughPlayer(archetype, playerRadius);
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
