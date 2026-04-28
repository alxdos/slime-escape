import {
  PET_ARCHETYPES,
  PET_ECONOMY,
  type PetArchetype,
  type PetEconomy,
  type PetQuality
} from '../../shared/content/pets';
import type { ClientProgression } from '../progression/ClientProgressionStore';
import { PET_VISUALS } from '../render/petVisuals';
import type { SpriteVisualSpec } from '../render/SpriteVisualSpec';

export type MenuLabPetViewModel = Readonly<{
  petId: string;
  displayName: string;
  quality: PetQuality;
  image: string;
}>;

export type MenuLabStandViewModel = Readonly<{
  quality: PetQuality;
  price: number;
  affordable: boolean;
  complete: boolean;
  ownedCount: number;
  totalCount: number;
}>;

export type MenuLabViewModel = Readonly<{
  totalXp: number;
  stands: Readonly<Record<PetQuality, MenuLabStandViewModel>>;
  pets: Readonly<Record<string, MenuLabPetViewModel>>;
}>;

export type MenuLabPurchaseResult =
  | Readonly<{
      ok: true;
      petId: string;
      quality: PetQuality;
      price: number;
      totalXp: number;
    }>
  | Readonly<{
      ok: false;
      reason: 'complete' | 'insufficientXp';
      quality: PetQuality;
      price: number;
      totalXp: number;
    }>;

export type MenuLabViewModelRegistries = Readonly<{
  pets?: Readonly<Record<string, PetArchetype>>;
  petVisuals?: Readonly<Record<string, SpriteVisualSpec>>;
  economy?: PetEconomy;
}>;

export function buildMenuLabViewModel(
  progression: ClientProgression,
  registries: MenuLabViewModelRegistries = {}
): MenuLabViewModel {
  const pets = registries.pets ?? PET_ARCHETYPES;
  const petVisuals = registries.petVisuals ?? PET_VISUALS;
  const economy = registries.economy ?? PET_ECONOMY;
  const totalXp = normalizeNonNegativeInteger(progression.totalXp);
  const ownedPetIds = new Set(progression.ownedPetIds);
  const petViewModels = buildPetViewModels(pets, petVisuals);
  const stands: Record<PetQuality, MenuLabStandViewModel> = {
    green: buildStandViewModel('green', pets, ownedPetIds, totalXp, economy),
    purple: buildStandViewModel('purple', pets, ownedPetIds, totalXp, economy)
  };

  return {
    totalXp,
    stands,
    pets: petViewModels
  };
}

function buildPetViewModels(
  pets: Readonly<Record<string, PetArchetype>>,
  petVisuals: Readonly<Record<string, SpriteVisualSpec>>
): Readonly<Record<string, MenuLabPetViewModel>> {
  const viewModels: Record<string, MenuLabPetViewModel> = {};
  for (const pet of sortedPets(pets)) {
    const visual = requireRegistryEntry(petVisuals, pet.id, 'pet visual');
    viewModels[pet.id] = {
      petId: pet.id,
      displayName: pet.displayName,
      quality: pet.quality,
      image: visual.image
    };
  }
  return viewModels;
}

function buildStandViewModel(
  quality: PetQuality,
  pets: Readonly<Record<string, PetArchetype>>,
  ownedPetIds: ReadonlySet<string>,
  totalXp: number,
  economy: PetEconomy
): MenuLabStandViewModel {
  const qualityPetIds = sortedPets(pets)
    .filter((pet) => pet.quality === quality)
    .map((pet) => pet.id);
  const ownedCount = qualityPetIds.filter((petId) => ownedPetIds.has(petId)).length;
  const totalCount = qualityPetIds.length;
  const price = normalizeNonNegativeInteger(economy.standPrices[quality]);
  const complete = totalCount > 0 && ownedCount >= totalCount;

  return {
    quality,
    price,
    affordable: !complete && totalXp >= price,
    complete,
    ownedCount,
    totalCount
  };
}

function sortedPets(
  pets: Readonly<Record<string, PetArchetype>>
): ReadonlyArray<PetArchetype> {
  return Object.values(pets).sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

function requireRegistryEntry<T>(
  registry: Readonly<Record<string, T>>,
  id: string,
  label: string
): T {
  const entry = registry[id];
  if (entry === undefined) {
    throw new Error(`Lab view model missing ${label}: ${id}`);
  }
  return entry;
}
