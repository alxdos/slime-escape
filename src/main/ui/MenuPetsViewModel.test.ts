import { describe, expect, it } from 'vitest';

import type { PetArchetype } from '../../shared/content/pets';
import type { ClientProgression } from '../progression/ClientProgressionStore';
import type { SpriteVisualSpec } from '../render/SpriteVisualSpec';

import { buildMenuPetsViewModel } from './MenuPetsViewModel';

const PETS = Object.freeze({
  'green-a': pet('green-a', 'Green A', 'green'),
  'green-b': pet('green-b', 'Green B', 'green'),
  'purple-a': pet('purple-a', 'Purple A', 'purple')
}) satisfies Readonly<Record<string, PetArchetype>>;

const PET_VISUALS = Object.freeze({
  'green-a': visual('green-a', '/green-a.png'),
  'green-b': visual('green-b', '/green-b.png'),
  'purple-a': visual('purple-a', '/purple-a.png')
}) satisfies Readonly<Record<string, SpriteVisualSpec>>;

describe('buildMenuPetsViewModel', () => {
  it('splits owned pets by quality and moves the selected pet out of inventory', () => {
    const viewModel = buildMenuPetsViewModel(
      progression({
        ownedPetIds: ['purple-a', 'green-b', 'green-a'],
        selectedPetId: 'green-b'
      }),
      {
        pets: PETS,
        petVisuals: PET_VISUALS
      }
    );

    expect(viewModel.selectedPet).toEqual({
      petId: 'green-b',
      displayName: 'Green B',
      quality: 'green',
      image: '/green-b.png'
    });
    expect(viewModel.inventory.green.map((pet) => pet.petId)).toEqual(['green-a']);
    expect(viewModel.inventory.purple.map((pet) => pet.petId)).toEqual(['purple-a']);
  });

  it('clears invalid selected ids instead of duplicating an unowned selection', () => {
    const viewModel = buildMenuPetsViewModel(
      progression({
        ownedPetIds: ['green-a'],
        selectedPetId: 'green-b'
      }),
      {
        pets: PETS,
        petVisuals: PET_VISUALS
      }
    );

    expect(viewModel.selectedPet).toBeNull();
    expect(viewModel.inventory.green.map((pet) => pet.petId)).toEqual(['green-a']);
  });

  it('throws when owned pet presentation data is missing', () => {
    expect(() =>
      buildMenuPetsViewModel(progression({ ownedPetIds: ['green-a'] }), {
        pets: {},
        petVisuals: PET_VISUALS
      })
    ).toThrow(/pet archetype: green-a/);
  });
});

function progression(overrides: Partial<ClientProgression> = {}): ClientProgression {
  return {
    schemaVersion: 1,
    totalXp: 0,
    ownedPetIds: [],
    selectedPetId: null,
    ...overrides
  };
}

function pet(id: string, displayName: string, quality: 'green' | 'purple'): PetArchetype {
  return {
    id,
    displayName,
    quality
  };
}

function visual(archetypeId: string, image: string): SpriteVisualSpec {
  return {
    archetypeId,
    image,
    sourceSizePx: { width: 64, height: 64 },
    worldSize: { width: 1, height: 1 },
    anchor: { x: 0.5, y: 0.5 }
  };
}
