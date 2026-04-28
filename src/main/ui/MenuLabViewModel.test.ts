import { describe, expect, it } from 'vitest';

import type { PetArchetype, PetEconomy } from '../../shared/content/pets';
import type { ClientProgression } from '../progression/ClientProgressionStore';
import type { SpriteVisualSpec } from '../render/SpriteVisualSpec';

import { buildMenuLabViewModel } from './MenuLabViewModel';

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

const ECONOMY = Object.freeze({
  xpPerDestroyedSlime: 1,
  standPrices: {
    green: 25,
    purple: 75
  }
}) satisfies PetEconomy;

describe('buildMenuLabViewModel', () => {
  it('derives stand price, affordability, completion, and pet images from progression', () => {
    const viewModel = buildMenuLabViewModel(
      progression({
        totalXp: 40,
        ownedPetIds: ['green-a']
      }),
      {
        pets: PETS,
        petVisuals: PET_VISUALS,
        economy: ECONOMY
      }
    );

    expect(viewModel.totalXp).toBe(40);
    expect(viewModel.stands.green).toEqual({
      quality: 'green',
      price: 25,
      affordable: true,
      complete: false,
      ownedCount: 1,
      totalCount: 2
    });
    expect(viewModel.stands.purple).toEqual({
      quality: 'purple',
      price: 75,
      affordable: false,
      complete: false,
      ownedCount: 0,
      totalCount: 1
    });
    expect(viewModel.pets['green-b']).toEqual({
      petId: 'green-b',
      displayName: 'Green B',
      quality: 'green',
      image: '/green-b.png'
    });
  });

  it('marks a stand complete only when all pets of that quality are owned', () => {
    const viewModel = buildMenuLabViewModel(
      progression({
        totalXp: 100,
        ownedPetIds: ['green-a', 'green-b']
      }),
      {
        pets: PETS,
        petVisuals: PET_VISUALS,
        economy: ECONOMY
      }
    );

    expect(viewModel.stands.green).toMatchObject({
      affordable: false,
      complete: true,
      ownedCount: 2,
      totalCount: 2
    });
    expect(viewModel.stands.purple).toMatchObject({
      affordable: true,
      complete: false
    });
  });

  it('throws when pet visual data is missing', () => {
    expect(() =>
      buildMenuLabViewModel(progression(), {
        pets: PETS,
        petVisuals: {
          'green-a': PET_VISUALS['green-a']!,
          'purple-a': PET_VISUALS['purple-a']!
        },
        economy: ECONOMY
      })
    ).toThrow(/pet visual: green-b/);
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
