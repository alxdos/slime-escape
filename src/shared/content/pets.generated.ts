// AUTO-GENERATED from content/pets.md by `npm run content:build`.
// Do not edit by hand.
import type { PetArchetype, PetEconomy } from './pets.js';

export const PET_01: PetArchetype = {
  id: 'pet-01',
  displayName: 'Sprout Buddy',
  quality: 'green'
};

export const PET_02: PetArchetype = {
  id: 'pet-02',
  displayName: 'Clover Buddy',
  quality: 'green'
};

export const PET_03: PetArchetype = {
  id: 'pet-03',
  displayName: 'Moss Buddy',
  quality: 'green'
};

export const PET_04: PetArchetype = {
  id: 'pet-04',
  displayName: 'Mint Buddy',
  quality: 'green'
};

export const PET_05: PetArchetype = {
  id: 'pet-05',
  displayName: 'Leaf Buddy',
  quality: 'green'
};

export const PET_11: PetArchetype = {
  id: 'pet-11',
  displayName: 'Amethyst Buddy',
  quality: 'purple'
};

export const PET_12: PetArchetype = {
  id: 'pet-12',
  displayName: 'Star Buddy',
  quality: 'purple'
};

export const PET_13: PetArchetype = {
  id: 'pet-13',
  displayName: 'Dream Buddy',
  quality: 'purple'
};

export const PET_14: PetArchetype = {
  id: 'pet-14',
  displayName: 'Mystic Buddy',
  quality: 'purple'
};

export const PET_15: PetArchetype = {
  id: 'pet-15',
  displayName: 'Royal Buddy',
  quality: 'purple'
};

export const PET_ARCHETYPE_SPECS = [PET_01, PET_02, PET_03, PET_04, PET_05, PET_11, PET_12, PET_13, PET_14, PET_15] as const satisfies ReadonlyArray<PetArchetype>;

export const PET_ECONOMY: PetEconomy = {
  xpPerDestroyedSlime: 1,
  standPrices: {
    green: 25,
    purple: 75
  }
};
