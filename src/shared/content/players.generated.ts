// AUTO-GENERATED from content/players.md by `npm run content:build`.
// Do not edit by hand.
export const HERO_SANDBOX = {
  id: 'hero-sandbox' as string,
  displayName: 'Hero',
  radius: 1.1458333333333333,
  contactBox: { width: 1.225, height: 2.2916666666666665 },
  maxSpeed: 6,
  maxHp: 1
} as const;

export const HERO_TRAINING = {
  id: 'hero-training' as string,
  displayName: 'Hero',
  radius: 1.1458333333333333,
  contactBox: { width: 1.225, height: 2.2916666666666665 },
  maxSpeed: 6,
  maxHp: 20
} as const;

export const PLAYER_ARCHETYPE_SPECS = [HERO_SANDBOX, HERO_TRAINING] as const;

export const SANDBOX_PLAYER = {
  position: { x: 0, y: 0 },
  radius: HERO_SANDBOX.radius,
  contactBox: HERO_SANDBOX.contactBox,
  maxSpeed: HERO_SANDBOX.maxSpeed,
  maxHp: HERO_SANDBOX.maxHp
} as const;

export const TRAINING_PLAYER = {
  position: { x: 0, y: 0 },
  radius: HERO_TRAINING.radius,
  contactBox: HERO_TRAINING.contactBox,
  maxSpeed: HERO_TRAINING.maxSpeed,
  maxHp: HERO_TRAINING.maxHp
} as const;
