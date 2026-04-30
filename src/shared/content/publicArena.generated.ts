// AUTO-GENERATED from content/sessions/portal.md by `npm run content:build`.
// Do not edit by hand.
import { TRAINING_PLAYER } from './players.generated.js';
import { ROCK_THROWER, SHOTGUN } from './weapons.generated.js';

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
