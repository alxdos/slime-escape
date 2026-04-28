import type { ParsedPet, ParsedPetsArea } from './parse';
import { escapeString, formatNumber, renderHeader, toConstName } from '../util/render';

export function renderPetContent(area: ParsedPetsArea): string {
  return `${renderHeader(area.sourcePath)}${renderImport()}${area.pets
    .map(renderPet)
    .join('\n\n')}\n\n${renderPetArchetypeSpecs(area.pets)}\n\n${renderPetEconomy(area)}\n`;
}

function renderImport(): string {
  return "import type { PetArchetype, PetEconomy } from './pets';\n\n";
}

function renderPet(pet: ParsedPet): string {
  return `export const ${toConstName(pet.id)}: PetArchetype = {
  id: '${escapeString(pet.id)}',
  displayName: '${escapeString(pet.displayName)}',
  quality: '${pet.quality}'
};`;
}

function renderPetArchetypeSpecs(pets: ReadonlyArray<ParsedPet>): string {
  const constNames = pets.map((pet) => toConstName(pet.id));
  return `export const PET_ARCHETYPE_SPECS = [${constNames.join(', ')}] as const satisfies ReadonlyArray<PetArchetype>;`;
}

function renderPetEconomy(area: ParsedPetsArea): string {
  return `export const PET_ECONOMY: PetEconomy = {
  xpPerDestroyedSlime: ${formatNumber(area.economy.xpPerDestroyedSlime)},
  standPrices: {
    green: ${formatNumber(area.economy.standPrices.green)},
    purple: ${formatNumber(area.economy.standPrices.purple)}
  }
};`;
}
