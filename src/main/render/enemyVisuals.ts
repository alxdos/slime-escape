import type { EnemyArchetype } from '../../shared/content/enemies';
import { ENEMY_VISUAL_SPECS } from './enemyVisuals.generated';
import type { SpriteVisualSpec } from './SpriteVisualSpec';

export { ENEMY_VISUAL_SPECS } from './enemyVisuals.generated';

export const ENEMY_VISUALS: Readonly<Record<string, SpriteVisualSpec>> =
  createEnemyVisualRegistry(ENEMY_VISUAL_SPECS);

export function validateEnemyVisuals(
  enemyRegistry: Readonly<Record<string, EnemyArchetype>>
): void {
  for (const archetypeId of Object.keys(enemyRegistry)) {
    if (ENEMY_VISUALS[archetypeId] === undefined) {
      throw new Error(`enemy visual missing for archetype "${archetypeId}"`);
    }
  }

  for (const visual of Object.values(ENEMY_VISUALS)) {
    if (enemyRegistry[visual.archetypeId] === undefined) {
      throw new Error(`enemy visual references unknown archetype "${visual.archetypeId}"`);
    }
  }
}

function createEnemyVisualRegistry(
  specs: ReadonlyArray<SpriteVisualSpec>
): Readonly<Record<string, SpriteVisualSpec>> {
  const registry: Record<string, SpriteVisualSpec> = {};
  for (const spec of specs) {
    if (registry[spec.archetypeId] !== undefined) {
      throw new Error(`duplicate enemy visual for archetype "${spec.archetypeId}"`);
    }
    registry[spec.archetypeId] = spec;
  }
  return registry;
}
