import type {
  ActorEffectApplication,
  DetonationTrigger,
  ExplosionSpec,
  FieldEffectSpec,
  FirePattern,
  FragmentSpec,
  ProjectileArchetype,
  ProjectileMotion,
  StatusEffectSpec,
  ProjectileVisualSpec
} from '../../../src/shared/content/weapons';

import type { ParsedWeapon, ParsedWeaponsArea } from './parse';
import { escapeString, formatNumber, renderHeader, toConstName } from '../util/render';

export function renderWeaponContent(area: ParsedWeaponsArea): string {
  return `${renderHeader(area.sourcePath)}${renderImport()}${area.weapons.map(renderWeapon).join('\n\n')}\n`;
}

function renderImport(): string {
  return "import type { WeaponArchetype } from './weapons';\n\n";
}

function renderWeapon(weapon: ParsedWeapon): string {
  return `export const ${toConstName(weapon.id)}: WeaponArchetype = {
  id: '${escapeString(weapon.id)}',
  displayName: '${escapeString(weapon.displayName)}',
  cooldownMs: ${formatNumber(weapon.cooldownMs)},
  firePattern: ${renderFirePattern(weapon.firePattern)},
  projectile: ${renderProjectile(weapon.projectile)}
};`;
}

function renderFirePattern(pattern: FirePattern): string {
  switch (pattern.kind) {
    case 'single':
      return `{ kind: 'single', spreadRadians: ${formatNumber(pattern.spreadRadians)}, count: ${formatNumber(pattern.count)} }`;
    case 'multiDirection':
      return `{ kind: 'multiDirection', directions: [${pattern.directions.map(formatNumber).join(', ')}] }`;
    case 'place':
      return "{ kind: 'place' }";
    default:
      return assertNever(pattern);
  }
}

function renderProjectile(projectile: ProjectileArchetype): string {
  return `{
    motion: ${renderProjectileMotion(projectile.motion)},
    size: { width: ${formatNumber(projectile.size.width)}, height: ${formatNumber(projectile.size.height)} },
    hitRadius: ${formatNumber(projectile.hitRadius)},
    impactDamage: ${formatNumber(projectile.impactDamage)},
    knockbackImpulse: ${formatNumber(projectile.knockbackImpulse)},
    pierceCount: ${formatNumber(projectile.pierceCount)},
    ttlMs: ${formatNumber(projectile.ttlMs)},
    groundOnImpact: ${projectile.groundOnImpact ? 'true' : 'false'},
    groundedLifetimeMs: ${renderNullableNumber(projectile.groundedLifetimeMs)},
    detonationTrigger: ${renderDetonationTrigger(projectile.detonationTrigger)},
    explosion: ${renderExplosion(projectile.explosion)},
    visual: ${renderProjectileVisual(projectile.visual)}
  }`;
}

function renderProjectileMotion(motion: ProjectileMotion): string {
  switch (motion.kind) {
    case 'linear':
      return `{ kind: 'linear', speed: ${formatNumber(motion.speed)} }`;
    case 'arc':
      return `{ kind: 'arc', speed: ${formatNumber(motion.speed)}, range: ${formatNumber(motion.range)}, flightMs: ${formatNumber(motion.flightMs)} }`;
    case 'placed':
      return "{ kind: 'placed' }";
    default:
      return assertNever(motion);
  }
}

function renderExplosion(explosion: ExplosionSpec | null): string {
  if (explosion === null) return 'null';
  return `{
      delayMs: ${formatNumber(explosion.delayMs)},
      radius: ${formatNumber(explosion.radius)},
      damage: ${formatNumber(explosion.damage)},
      knockbackImpulse: ${formatNumber(explosion.knockbackImpulse)},
      fragments: ${renderFragment(explosion.fragments)},
      fieldEffect: ${renderFieldEffect(explosion.fieldEffect)},
      effects: [${explosion.effects.map(renderActorEffect).join(', ')}]
    }`;
}

function renderDetonationTrigger(trigger: DetonationTrigger | null): string {
  if (trigger === null) return 'null';
  switch (trigger.kind) {
    case 'timer':
      return "{ kind: 'timer' }";
    case 'proximity':
    case 'timerOrProximity':
      return `{ kind: '${trigger.kind}', radius: ${formatNumber(trigger.radius)}, armDelayMs: ${formatNumber(trigger.armDelayMs)} }`;
    default:
      return assertNever(trigger);
  }
}

function renderFieldEffect(fieldEffect: FieldEffectSpec | null): string {
  if (fieldEffect === null) return 'null';
  return `{ archetypeId: '${escapeString(fieldEffect.archetypeId)}', radius: ${formatNumber(fieldEffect.radius)}, durationMs: ${formatNumber(fieldEffect.durationMs)}, applyEveryMs: ${formatNumber(fieldEffect.applyEveryMs)}, effects: [${fieldEffect.effects.map(renderActorEffect).join(', ')}] }`;
}

function renderActorEffect(effect: ActorEffectApplication): string {
  switch (effect.kind) {
    case 'damage':
      return `{ kind: 'damage', amount: ${formatNumber(effect.amount)} }`;
    case 'status':
      return `{ kind: 'status', status: ${renderStatusEffect(effect.status)} }`;
    default:
      return assertNever(effect);
  }
}

function renderStatusEffect(status: StatusEffectSpec): string {
  switch (status.kind) {
    case 'burn':
    case 'poison':
      return `{ kind: '${status.kind}', damagePerTick: ${formatNumber(status.damagePerTick)}, tickEveryMs: ${formatNumber(status.tickEveryMs)}, durationMs: ${formatNumber(status.durationMs)} }`;
    case 'slow':
      return `{ kind: 'slow', speedMultiplier: ${formatNumber(status.speedMultiplier)}, durationMs: ${formatNumber(status.durationMs)} }`;
    default:
      return assertNever(status);
  }
}

function renderFragment(fragment: FragmentSpec | null): string {
  if (fragment === null) return 'null';
  return `{ weaponArchetypeId: '${escapeString(fragment.weaponArchetypeId)}', count: ${formatNumber(fragment.count)}, spreadRadians: ${formatNumber(fragment.spreadRadians)} }`;
}

function renderProjectileVisual(visual: ProjectileVisualSpec): string {
  return `{ spinRadiansPerSec: ${formatNumber(visual.spinRadiansPerSec)}, rotateWhileFlying: ${visual.rotateWhileFlying ? 'true' : 'false'}, pulseWhenGrounded: ${visual.pulseWhenGrounded ? 'true' : 'false'}, explosionRadiusIndicator: ${visual.explosionRadiusIndicator ? 'true' : 'false'} }`;
}

function renderNullableNumber(value: number | null): string {
  return value === null ? 'null' : formatNumber(value);
}

function assertNever(value: never): never {
  throw new Error(`unhandled weapon render value: ${String(value)}`);
}
