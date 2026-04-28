import type { PetQuality } from '../../../src/shared/content/pets';

import type {
  MarkdownDocument,
  MarkdownSection,
  MarkdownTable,
  MarkdownTableRow
} from '../parse';
import { requireSection } from '../util/require';
import { requireInlineImage } from '../util/inlineMedia';
import {
  cellError,
  readMarkdownDocument,
  requireField,
  requireSingleTable,
  sectionError
} from '../util/markdown';
import { readSpriteAssetMetrics, type SpriteAssetMetrics } from '../util/spriteMetrics';

export type ParsedPetVisual = Readonly<{
  image: string;
  metrics: SpriteAssetMetrics;
}>;

export type ParsedPet = Readonly<{
  id: string;
  displayName: string;
  quality: PetQuality;
  visual: ParsedPetVisual;
}>;

export type ParsedPetEconomy = Readonly<{
  xpPerDestroyedSlime: number;
  standPrices: Readonly<Record<PetQuality, number>>;
}>;

export type ParsedPetsArea = Readonly<{
  sourcePath: string;
  pets: ReadonlyArray<ParsedPet>;
  economy: ParsedPetEconomy;
}>;

export async function parsePetsArea(sourcePath: string): Promise<ParsedPetsArea> {
  const document = await readMarkdownDocument(sourcePath);
  return parsePetsDocument(document);
}

function parsePetsDocument(document: MarkdownDocument): ParsedPetsArea {
  const petsSection = requireSection(document, 'Pets');
  const economySection = requireSection(document, 'Economy');
  const pets = petsSection.sections.map(parsePetDefinition);

  assertUniquePetIds(petsSection, pets);
  assertPetPoolCounts(petsSection, pets);

  return {
    sourcePath: document.filePath,
    pets,
    economy: parseEconomy(economySection, requireSingleTable(economySection))
  };
}

function parsePetDefinition(section: MarkdownSection): ParsedPet {
  const table = requireSingleTable(section);
  assertNoForbiddenSpriteFields(section, table);
  const image = requireInlineImage(section);
  const metrics = readSpriteAssetMetrics({
    sourcePath: section.filePath,
    rowId: section.title,
    imagePath: image.url
  });

  return {
    id: section.title,
    displayName: requireField(section, table, 'displayName'),
    quality: parsePetQuality(section, table, requireField(section, table, 'quality')),
    visual: {
      image: image.url,
      metrics
    }
  };
}

function parseEconomy(section: MarkdownSection, table: MarkdownTable): ParsedPetEconomy {
  const xpPerDestroyedSlime = parseNonNegativeIntegerField(section, table, 'xpPerDestroyedSlime');
  const greenStandPrice = parseNonNegativeIntegerField(section, table, 'greenStandPrice');
  const purpleStandPrice = parseNonNegativeIntegerField(section, table, 'purpleStandPrice');

  if (greenStandPrice >= purpleStandPrice) {
    throw cellError(
      section,
      findFieldRow(table, 'greenStandPrice')?.position ?? section.position,
      'greenStandPrice',
      'value',
      'expected greenStandPrice to be lower than purpleStandPrice'
    );
  }

  return {
    xpPerDestroyedSlime,
    standPrices: {
      green: greenStandPrice,
      purple: purpleStandPrice
    }
  };
}

function parsePetQuality(
  section: MarkdownSection,
  table: MarkdownTable,
  rawQuality: string
): PetQuality {
  switch (rawQuality) {
    case 'green':
    case 'purple':
      return rawQuality;
    default:
      throw cellError(
        section,
        findFieldRow(table, 'quality')?.position ?? section.position,
        'quality',
        'value',
        'expected green or purple'
      );
  }
}

function parseNonNegativeIntegerField(
  section: MarkdownSection,
  table: MarkdownTable,
  fieldName: string
): number {
  const raw = requireField(section, table, fieldName);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw cellError(
      section,
      findFieldRow(table, fieldName)?.position ?? section.position,
      fieldName,
      'value',
      'expected integer >= 0'
    );
  }
  return value;
}

function assertNoForbiddenSpriteFields(section: MarkdownSection, table: MarkdownTable): void {
  for (const row of table.rows) {
    const field = row.cells[0]?.value;
    if (
      field === 'image' ||
      field === 'sourceSizePx' ||
      field === 'worldSize' ||
      field === 'anchor'
    ) {
      throw cellError(
        section,
        row.position,
        field,
        'field',
        'sprite fields are derived from the inline image under pet H2'
      );
    }
  }
}

function assertUniquePetIds(section: MarkdownSection, pets: ReadonlyArray<ParsedPet>): void {
  const seenPetIds = new Set<string>();
  for (const pet of pets) {
    if (seenPetIds.has(pet.id)) {
      throw sectionError(section, `duplicate pet id "${pet.id}"`);
    }
    seenPetIds.add(pet.id);
  }
}

function assertPetPoolCounts(section: MarkdownSection, pets: ReadonlyArray<ParsedPet>): void {
  const greenCount = pets.filter((pet) => pet.quality === 'green').length;
  const purpleCount = pets.filter((pet) => pet.quality === 'purple').length;

  if (greenCount !== 5 || purpleCount !== 5) {
    throw sectionError(
      section,
      `expected exactly 5 green pets and 5 purple pets, got ${greenCount} green and ${purpleCount} purple`
    );
  }
}

function findFieldRow(table: MarkdownTable, fieldName: string): MarkdownTableRow | null {
  return table.rows.find((row) => row.cells[0]?.value === fieldName) ?? null;
}
