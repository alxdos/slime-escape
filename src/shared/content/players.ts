import type { ContactBox, PlayerSpawn } from '../session.js';

import {
  PLAYER_ARCHETYPE_SPECS,
  SANDBOX_PLAYER,
  TRAINING_PLAYER
} from './players.generated.js';

export type PlayerArchetype = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  contactBox: ContactBox;
  maxSpeed: number;
  maxHp: number;
}>;

export * from './players.generated.js';

export const PLAYER_ARCHETYPES: Readonly<Record<string, PlayerArchetype>> = {
  ...createPlayerRegistry(PLAYER_ARCHETYPE_SPECS)
};

export type { PlayerSpawn };

function createPlayerRegistry(
  archetypes: ReadonlyArray<PlayerArchetype>
): Readonly<Record<string, PlayerArchetype>> {
  const registry: Record<string, PlayerArchetype> = {};
  for (const archetype of archetypes) {
    if (registry[archetype.id] !== undefined) {
      throw new Error(`duplicate player archetype "${archetype.id}"`);
    }
    registry[archetype.id] = archetype;
  }
  return registry;
}
