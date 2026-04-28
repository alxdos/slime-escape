import type { ParsedPet, ParsedPetsArea } from './parse';
import { escapeString, formatNumber, renderHeader, toConstName } from '../util/render';

export function renderPetVisuals(area: ParsedPetsArea): string {
  return `${renderHeader(area.sourcePath)}${renderImport()}${area.pets
    .map(renderPetVisual)
    .join('\n\n')}\n\n${renderPetVisualSpecs(area.pets)}\n`;
}

function renderImport(): string {
  return "import type { SpriteVisualSpec } from './SpriteVisualSpec';\n\n";
}

function renderPetVisual(pet: ParsedPet): string {
  const { sourceSizePx, worldSize } = pet.visual.metrics;
  return `export const ${toConstName(pet.id)}_PET_VISUAL: SpriteVisualSpec = {
  archetypeId: '${escapeString(pet.id)}',
  image: '${escapeString(pet.visual.image)}',
  sourceSizePx: { width: ${formatNumber(sourceSizePx.width)}, height: ${formatNumber(sourceSizePx.height)} },
  worldSize: { width: ${formatNumber(worldSize.width)}, height: ${formatNumber(worldSize.height)} },
  anchor: { x: 0.5, y: 0.5 }
};`;
}

function renderPetVisualSpecs(pets: ReadonlyArray<ParsedPet>): string {
  const constNames = pets.map((pet) => `${toConstName(pet.id)}_PET_VISUAL`);
  return `export const PET_VISUAL_SPECS = [${constNames.join(', ')}] as const satisfies ReadonlyArray<SpriteVisualSpec>;`;
}
