import type { PlayerArchetype } from '../../shared/content/players';
import { HERO_VISUAL } from './playerVisuals.generated';
import type { SpriteVisualSpec } from './SpriteVisualSpec';

export { HERO_VISUAL } from './playerVisuals.generated';

export const PLAYER_VISUALS: Readonly<Record<string, SpriteVisualSpec>> = {
  [HERO_VISUAL.archetypeId]: HERO_VISUAL
};

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
