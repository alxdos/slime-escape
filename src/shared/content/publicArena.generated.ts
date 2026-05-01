// AUTO-GENERATED from content/sessions/{portal,public-arena}.md by `npm run content:build`.
// Do not edit by hand.
import { BOSS_TOWER_SENTINEL } from './bosses.generated.js';
import { TRAINING_PLAYER } from './players.generated.js';
import { FIREBALL_STAFF, ROCK_THROWER, SHOTGUN } from './weapons.generated.js';

export const PUBLIC_ARENA_PRESENTATION_CONTENT = {
  arena: { width: 35, height: 35 },
  player: TRAINING_PLAYER,
  loadout: { weapons: [ROCK_THROWER.id, SHOTGUN.id], selectedIndex: 0 },
  backgrounds: [
    {
      id: 'portal',
      imageUrl: '/images/bg/bg-01.jpg'
    }
  ],
  activeBackgroundId: 'portal'
} as const;

export const PUBLIC_ARENA_HOST_CONTENT = {
  sessionPresetId: 'public-arena',
  player: TRAINING_PLAYER,
  loadout: { weapons: [ROCK_THROWER.id, SHOTGUN.id], selectedIndex: 0 },
  bossWeaponId: FIREBALL_STAFF.id,
  bossArchetypeId: BOSS_TOWER_SENTINEL.id,
  spawnInvulnerabilityMs: 900
} as const;
