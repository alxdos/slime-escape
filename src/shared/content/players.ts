import type { PlayerSpawn } from '../session';

import { HERO, SANDBOX_PLAYER, TRAINING_PLAYER } from './players.generated';

export type PlayerArchetype = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  maxSpeed: number;
  maxHp: number;
}>;

export { HERO, SANDBOX_PLAYER, TRAINING_PLAYER } from './players.generated';

export const PLAYER_ARCHETYPES: Readonly<Record<string, PlayerArchetype>> = {
  [HERO.id]: HERO
};

export type { PlayerSpawn };
