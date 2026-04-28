import {
  PET_ARCHETYPES,
  type PetArchetype,
  type PetQuality
} from '../../shared/content/pets';
import type { ClientProgression } from '../progression/ClientProgressionStore';
import { PET_VISUALS } from '../render/petVisuals';
import type { SpriteVisualSpec } from '../render/SpriteVisualSpec';

export type MenuPetsPetViewModel = Readonly<{
  petId: string;
  displayName: string;
  quality: PetQuality;
  image: string;
}>;

export type MenuPetsViewModel = Readonly<{
  selectedPet: MenuPetsPetViewModel | null;
  inventory: Readonly<Record<PetQuality, ReadonlyArray<MenuPetsPetViewModel>>>;
}>;

export type MenuPetsSelectionResult =
  | Readonly<{ ok: true; selectedPetId: string }>
  | Readonly<{ ok: false; reason: 'notOwned'; selectedPetId: string }>;

export type MenuPetsViewModelRegistries = Readonly<{
  pets?: Readonly<Record<string, PetArchetype>>;
  petVisuals?: Readonly<Record<string, SpriteVisualSpec>>;
}>;

export function buildMenuPetsViewModel(
  progression: ClientProgression,
  registries: MenuPetsViewModelRegistries = {}
): MenuPetsViewModel {
  const pets = registries.pets ?? PET_ARCHETYPES;
  const petVisuals = registries.petVisuals ?? PET_VISUALS;
  const ownedPetIds = new Set(progression.ownedPetIds);
  const selectedPetId =
    progression.selectedPetId !== null && ownedPetIds.has(progression.selectedPetId)
      ? progression.selectedPetId
      : null;
  const ownedPets = sortedPetIds(progression.ownedPetIds)
    .filter((petId) => petId !== selectedPetId)
    .map((petId) => buildPetViewModel(petId, pets, petVisuals));

  return {
    selectedPet:
      selectedPetId === null ? null : buildPetViewModel(selectedPetId, pets, petVisuals),
    inventory: {
      green: ownedPets.filter((pet) => pet.quality === 'green'),
      purple: ownedPets.filter((pet) => pet.quality === 'purple')
    }
  };
}

function buildPetViewModel(
  petId: string,
  pets: Readonly<Record<string, PetArchetype>>,
  petVisuals: Readonly<Record<string, SpriteVisualSpec>>
): MenuPetsPetViewModel {
  const pet = requireRegistryEntry(pets, petId, 'pet archetype');
  const visual = requireRegistryEntry(petVisuals, petId, 'pet visual');
  return {
    petId,
    displayName: pet.displayName,
    quality: pet.quality,
    image: visual.image
  };
}

function sortedPetIds(petIds: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...petIds].sort((left, right) => left.localeCompare(right));
}

function requireRegistryEntry<T>(
  registry: Readonly<Record<string, T>>,
  id: string,
  label: string
): T {
  const entry = registry[id];
  if (entry === undefined) {
    throw new Error(`Pets view model missing ${label}: ${id}`);
  }
  return entry;
}
