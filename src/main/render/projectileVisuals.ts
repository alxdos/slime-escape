import type { WeaponArchetype } from '../../shared/content/weapons';
import { PROJECTILE_VISUAL_SPECS } from './projectileVisuals.generated';
import type { SpriteVisualSpec } from './SpriteVisualSpec';

export { PROJECTILE_VISUAL_SPECS } from './projectileVisuals.generated';

export const PROJECTILE_VISUALS: Readonly<Record<string, SpriteVisualSpec>> =
  createProjectileVisualRegistry(PROJECTILE_VISUAL_SPECS);

export function validateProjectileVisuals(
  weaponRegistry: Readonly<Record<string, WeaponArchetype>>
): void {
  for (const archetypeId of Object.keys(weaponRegistry)) {
    if (PROJECTILE_VISUALS[archetypeId] === undefined) {
      throw new Error(`projectile visual missing for weapon archetype "${archetypeId}"`);
    }
  }

  for (const [registryKey, visual] of Object.entries(PROJECTILE_VISUALS)) {
    if (registryKey !== visual.archetypeId) {
      throw new Error(
        `projectile visual registry key "${registryKey}" does not match archetypeId "${visual.archetypeId}"`
      );
    }
    const weapon = weaponRegistry[visual.archetypeId];
    if (weapon === undefined) {
      throw new Error(`projectile visual references unknown weapon archetype "${visual.archetypeId}"`);
    }
    assertProjectileWorldSizeMatchesWeapon(visual, weapon);
  }
}

function createProjectileVisualRegistry(
  specs: ReadonlyArray<SpriteVisualSpec>
): Readonly<Record<string, SpriteVisualSpec>> {
  const registry: Record<string, SpriteVisualSpec> = {};
  for (const spec of specs) {
    if (registry[spec.archetypeId] !== undefined) {
      throw new Error(`duplicate projectile visual for weapon archetype "${spec.archetypeId}"`);
    }
    registry[spec.archetypeId] = spec;
  }
  return registry;
}

function assertProjectileWorldSizeMatchesWeapon(
  visual: SpriteVisualSpec,
  weapon: WeaponArchetype
): void {
  if (
    !nearlyEqual(visual.worldSize.width, weapon.projectile.size.width) ||
    !nearlyEqual(visual.worldSize.height, weapon.projectile.size.height)
  ) {
    throw new Error(
      `projectile visual "${visual.archetypeId}" worldSize does not match weapon projectile.size`
    );
  }
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9;
}
