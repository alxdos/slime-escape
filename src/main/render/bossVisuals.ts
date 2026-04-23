import type { BossArchetype } from '../../shared/content/bosses';
import { BOSS_VISUAL_SPECS } from './bossVisuals.generated';
import type { SpriteVisualSpec } from './SpriteVisualSpec';

export { BOSS_VISUAL_SPECS } from './bossVisuals.generated';

export const BOSS_VISUALS: Readonly<Record<string, SpriteVisualSpec>> =
  createBossVisualRegistry(BOSS_VISUAL_SPECS);

export function validateBossVisuals(
  bossRegistry: Readonly<Record<string, BossArchetype>>
): void {
  for (const archetypeId of Object.keys(bossRegistry)) {
    if (BOSS_VISUALS[archetypeId] === undefined) {
      throw new Error(`boss visual missing for archetype "${archetypeId}"`);
    }
  }

  for (const visual of Object.values(BOSS_VISUALS)) {
    if (bossRegistry[visual.archetypeId] === undefined) {
      throw new Error(`boss visual references unknown archetype "${visual.archetypeId}"`);
    }
  }
}

function createBossVisualRegistry(
  specs: ReadonlyArray<SpriteVisualSpec>
): Readonly<Record<string, SpriteVisualSpec>> {
  const registry: Record<string, SpriteVisualSpec> = {};
  for (const spec of specs) {
    if (registry[spec.archetypeId] !== undefined) {
      throw new Error(`duplicate boss visual for archetype "${spec.archetypeId}"`);
    }
    registry[spec.archetypeId] = spec;
  }
  return registry;
}
