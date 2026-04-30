export const PUBLIC_ARENA_REGULAR_WEAPON_ID = 'rock-thrower';
export const PUBLIC_ARENA_BOSS_WEAPON_ID = 'fireball-staff';
export const PUBLIC_ARENA_BOSS_ARCHETYPE_ID = 'boss-tower-sentinel';
export const PUBLIC_ARENA_SLIME_FORM_CHAIN = [
  'slime-one-eye',
  'slime-hornling',
  'slime-many-eye',
  'slime-stonehead',
  'slime-shell'
] as const;
export const PUBLIC_ARENA_BOSS_LEVEL = PUBLIC_ARENA_SLIME_FORM_CHAIN.length + 1;
