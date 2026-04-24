import type { DropArchetype } from '../../shared/content/drops';
import { DROP_VISUAL_SPECS } from './dropVisuals.generated';
import type { SpriteVisualSpec } from './SpriteVisualSpec';

export { DROP_VISUAL_SPECS } from './dropVisuals.generated';

export const DROP_VISUALS: Readonly<Record<string, SpriteVisualSpec>> =
  createDropVisualRegistry(DROP_VISUAL_SPECS);

export function validateDropVisuals(
  dropRegistry: Readonly<Record<string, DropArchetype>>
): void {
  for (const archetypeId of Object.keys(dropRegistry)) {
    if (DROP_VISUALS[archetypeId] === undefined) {
      throw new Error(`drop visual missing for archetype "${archetypeId}"`);
    }
  }

  for (const [registryKey, visual] of Object.entries(DROP_VISUALS)) {
    if (registryKey !== visual.archetypeId) {
      throw new Error(
        `drop visual registry key "${registryKey}" does not match archetypeId "${visual.archetypeId}"`
      );
    }
    const drop = dropRegistry[visual.archetypeId];
    if (drop === undefined) {
      throw new Error(`drop visual references unknown archetype "${visual.archetypeId}"`);
    }
    assertDropWorldSizeMatchesRadius(visual, drop);
  }
}

function createDropVisualRegistry(
  specs: ReadonlyArray<SpriteVisualSpec>
): Readonly<Record<string, SpriteVisualSpec>> {
  const registry: Record<string, SpriteVisualSpec> = {};
  for (const spec of specs) {
    if (registry[spec.archetypeId] !== undefined) {
      throw new Error(`duplicate drop visual for archetype "${spec.archetypeId}"`);
    }
    registry[spec.archetypeId] = spec;
  }
  return registry;
}

function assertDropWorldSizeMatchesRadius(
  visual: SpriteVisualSpec,
  drop: DropArchetype
): void {
  const expectedRadius = Math.min(visual.worldSize.width, visual.worldSize.height) / 2;
  if (!nearlyEqual(drop.radius, expectedRadius)) {
    throw new Error(`drop visual "${visual.archetypeId}" worldSize does not match drop radius`);
  }
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9;
}
