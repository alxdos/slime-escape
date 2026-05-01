import {
  FRAGMENT,
  HEAL_ORB,
  MAGNET,
  MULTI_SHOT,
  OVERDRIVE,
  PIERCE,
  SIZE_UP,
  SPEED_UP
} from './drops.generated.js';

import type { WeaponModifier } from './weapons.js';

export type PickupModifier = Readonly<{
  kind: 'dropMagnet';
  pickupRadiusMultiplier: number;
  attractSpeed: number;
}>;

export type DropEffect =
  | Readonly<{ kind: 'heal'; amount: number }>
  | Readonly<{ kind: 'addWeaponModifier'; modifier: WeaponModifier; target: 'selectedWeapon' }>
  | Readonly<{
      kind: 'temporaryOverdrive';
      cooldownMultiplier: number;
      durationMs: number;
      target: 'selectedWeapon';
    }>
  | Readonly<{ kind: 'pickupModifier'; modifier: PickupModifier }>;

export type DropArchetype = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  ttlMs: number;
  effect: DropEffect;
  color: number;
}>;

export { FRAGMENT, HEAL_ORB, MAGNET, MULTI_SHOT, OVERDRIVE, PIERCE, SIZE_UP, SPEED_UP };

export const DROP_ARCHETYPES: Readonly<Record<string, DropArchetype>> = {
  [HEAL_ORB.id]: HEAL_ORB,
  [SIZE_UP.id]: SIZE_UP,
  [SPEED_UP.id]: SPEED_UP,
  [MULTI_SHOT.id]: MULTI_SHOT,
  [PIERCE.id]: PIERCE,
  [FRAGMENT.id]: FRAGMENT,
  [OVERDRIVE.id]: OVERDRIVE,
  [MAGNET.id]: MAGNET
};
