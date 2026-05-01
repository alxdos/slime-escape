import type { PlayerArchetype } from '../../shared/content/players';
import { PLAYER_VISUAL_SPECS } from './playerVisuals.generated';
import type { SpriteVisualSpec } from './SpriteVisualSpec';

export { PLAYER_VISUAL_SPECS } from './playerVisuals.generated';

export const PLAYER_VISUALS: Readonly<Record<string, SpriteVisualSpec>> =
  createPlayerVisualRegistry(PLAYER_VISUAL_SPECS);

// PlayerSnapshot does not carry a player archetype id yet, so the runtime
// renderer uses the shared hero sprite that all current player archetypes point to.
export const DEFAULT_PLAYER_VISUAL = requireDefaultPlayerVisual(PLAYER_VISUAL_SPECS);

export function validatePlayerVisuals(
  playerRegistry: Readonly<Record<string, PlayerArchetype>>
): void {
  for (const archetypeId of Object.keys(playerRegistry)) {
    if (PLAYER_VISUALS[archetypeId] === undefined) {
      throw new Error(`player visual missing for archetype "${archetypeId}"`);
    }
  }

  for (const [registryKey, visual] of Object.entries(PLAYER_VISUALS)) {
    if (registryKey !== visual.archetypeId) {
      throw new Error(
        `player visual registry key "${registryKey}" does not match archetypeId "${visual.archetypeId}"`
      );
    }
    if (playerRegistry[visual.archetypeId] === undefined) {
      throw new Error(`player visual references unknown archetype "${visual.archetypeId}"`);
    }
  }
}

function createPlayerVisualRegistry(
  specs: ReadonlyArray<SpriteVisualSpec>
): Readonly<Record<string, SpriteVisualSpec>> {
  const registry: Record<string, SpriteVisualSpec> = {};
  for (const spec of specs) {
    if (registry[spec.archetypeId] !== undefined) {
      throw new Error(`duplicate player visual for archetype "${spec.archetypeId}"`);
    }
    registry[spec.archetypeId] = spec;
  }
  return registry;
}

function requireDefaultPlayerVisual(specs: ReadonlyArray<SpriteVisualSpec>): SpriteVisualSpec {
  const defaultSpec = specs[0];
  if (defaultSpec === undefined) {
    throw new Error('expected at least one player visual spec');
  }
  return defaultSpec;
}
