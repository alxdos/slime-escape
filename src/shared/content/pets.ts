import { PET_ARCHETYPE_SPECS } from './pets.generated.js';

export type PetQuality = 'green' | 'purple';

export type PetArchetype = Readonly<{
  id: string;
  displayName: string;
  quality: PetQuality;
}>;

export type PetEconomy = Readonly<{
  xpPerDestroyedSlime: number;
  standPrices: Readonly<Record<PetQuality, number>>;
}>;

export const PET_QUALITIES = ['green', 'purple'] as const satisfies ReadonlyArray<PetQuality>;

export * from './pets.generated.js';

export const PET_ARCHETYPES: Readonly<Record<string, PetArchetype>> =
  createPetRegistry(PET_ARCHETYPE_SPECS);

function createPetRegistry(
  archetypes: ReadonlyArray<PetArchetype>
): Readonly<Record<string, PetArchetype>> {
  const registry: Record<string, PetArchetype> = {};
  for (const archetype of archetypes) {
    if (registry[archetype.id] !== undefined) {
      throw new Error(`duplicate pet archetype "${archetype.id}"`);
    }
    registry[archetype.id] = archetype;
  }
  return registry;
}
