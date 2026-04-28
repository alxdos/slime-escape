import type { PetArchetype } from '../../shared/content/pets';
import { PET_VISUAL_SPECS } from './petVisuals.generated';
import type { SpriteVisualSpec } from './SpriteVisualSpec';

export { PET_VISUAL_SPECS } from './petVisuals.generated';

export const PET_VISUALS: Readonly<Record<string, SpriteVisualSpec>> =
  createPetVisualRegistry(PET_VISUAL_SPECS);

export function validatePetVisuals(
  petRegistry: Readonly<Record<string, PetArchetype>>
): void {
  for (const archetypeId of Object.keys(petRegistry)) {
    if (PET_VISUALS[archetypeId] === undefined) {
      throw new Error(`pet visual missing for archetype "${archetypeId}"`);
    }
  }

  for (const [registryKey, visual] of Object.entries(PET_VISUALS)) {
    if (registryKey !== visual.archetypeId) {
      throw new Error(
        `pet visual registry key "${registryKey}" does not match archetypeId "${visual.archetypeId}"`
      );
    }
    if (petRegistry[visual.archetypeId] === undefined) {
      throw new Error(`pet visual references unknown archetype "${visual.archetypeId}"`);
    }
  }
}

function createPetVisualRegistry(
  specs: ReadonlyArray<SpriteVisualSpec>
): Readonly<Record<string, SpriteVisualSpec>> {
  const registry: Record<string, SpriteVisualSpec> = {};
  for (const spec of specs) {
    if (registry[spec.archetypeId] !== undefined) {
      throw new Error(`duplicate pet visual for archetype "${spec.archetypeId}"`);
    }
    registry[spec.archetypeId] = spec;
  }
  return registry;
}
