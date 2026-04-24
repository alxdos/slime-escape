// AUTO-GENERATED from content/players.md by `npm run content:build`.
// Do not edit by hand.
import type { PlayerSpawn } from '../session';
import type { PlayerArchetype } from './players';

export const HERO_SANDBOX: PlayerArchetype = {
  id: 'hero-sandbox',
  displayName: 'Hero',
  radius: 1.1458333333333333,
  contactBox: { width: 1.225, height: 2.2916666666666665 },
  maxSpeed: 6,
  maxHp: 1
};

export const HERO_TRAINING: PlayerArchetype = {
  id: 'hero-training',
  displayName: 'Hero',
  radius: 1.1458333333333333,
  contactBox: { width: 1.225, height: 2.2916666666666665 },
  maxSpeed: 6,
  maxHp: 5
};

export const PLAYER_ARCHETYPE_SPECS = [HERO_SANDBOX, HERO_TRAINING] as const satisfies ReadonlyArray<PlayerArchetype>;

export const SANDBOX_PLAYER: PlayerSpawn = {
  position: { x: 0, y: 0 },
  radius: HERO_SANDBOX.radius,
  contactBox: HERO_SANDBOX.contactBox,
  maxSpeed: HERO_SANDBOX.maxSpeed,
  maxHp: HERO_SANDBOX.maxHp
};

export const TRAINING_PLAYER: PlayerSpawn = {
  position: { x: 0, y: 0 },
  radius: HERO_TRAINING.radius,
  contactBox: HERO_TRAINING.contactBox,
  maxSpeed: HERO_TRAINING.maxSpeed,
  maxHp: HERO_TRAINING.maxHp
};
