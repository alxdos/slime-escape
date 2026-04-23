// AUTO-GENERATED from content/players.md by `npm run content:build`.
// Do not edit by hand.
import type { PlayerSpawn } from '../session';
import type { PlayerArchetype } from './players';

export const HERO: PlayerArchetype = {
  id: 'hero',
  displayName: 'Hero',
  radius: 0.5,
  maxSpeed: 6,
  maxHp: 5
};

export const SANDBOX_PLAYER: PlayerSpawn = {
  position: { x: 0, y: 0 },
  radius: HERO.radius,
  maxSpeed: HERO.maxSpeed,
  maxHp: HERO.maxHp
};

export const TRAINING_PLAYER: PlayerSpawn = {
  position: { x: 0, y: 0 },
  radius: HERO.radius,
  maxSpeed: HERO.maxSpeed,
  maxHp: HERO.maxHp
};
