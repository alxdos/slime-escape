import { describe, expect, it } from 'vitest';

import { PET_01, PET_ARCHETYPES, type PetArchetype } from '../../shared/content/pets';

import { PET_VISUALS, validatePetVisuals } from './petVisuals';

describe('validatePetVisuals', () => {
  it('accepts the committed pet registry', () => {
    expect(() => validatePetVisuals(PET_ARCHETYPES)).not.toThrow();
  });

  it('rejects pet archetypes without a visual spec', () => {
    const ghostPet: PetArchetype = {
      ...PET_01,
      id: 'ghost-pet'
    };

    expect(() =>
      validatePetVisuals({
        ...PET_ARCHETYPES,
        [ghostPet.id]: ghostPet
      })
    ).toThrow('pet visual missing for archetype "ghost-pet"');
  });

  it('rejects orphan pet visuals', () => {
    expect(() => validatePetVisuals({})).toThrow(
      'pet visual references unknown archetype "pet-01"'
    );
  });

  it('covers every committed pet archetype id', () => {
    expect(Object.keys(PET_VISUALS)).toHaveLength(10);
    expect(Object.keys(PET_VISUALS).sort()).toEqual(Object.keys(PET_ARCHETYPES).sort());
  });
});
