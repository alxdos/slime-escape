import type { PlayerSpawn } from '../session';

export const SANDBOX_PLAYER: PlayerSpawn = {
  position: { x: 0, y: 0 },
  radius: 0.5,
  maxSpeed: 6,
  maxHp: 1
};

export const TRAINING_PLAYER: PlayerSpawn = {
  position: { x: 0, y: 0 },
  radius: 0.5,
  maxSpeed: 6,
  maxHp: 5
};
