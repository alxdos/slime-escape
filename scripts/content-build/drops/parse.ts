import type { DropEffect } from '../../../src/shared/content/drops';
import type { WeaponModifier } from '../../../src/shared/content/weapons';

import {
  type MarkdownDocument,
  type MarkdownSection,
  type MarkdownTable,
  type MarkdownTableRow
} from '../parse';
import { requireCell, requireNumber, requireRow, requireSection } from '../util/require';
import {
  assertKnownReferences,
  cellError,
  getRowId,
  readMarkdownDocument,
  requireField,
  requireFieldHexColor,
  requireSingleTable
} from '../util/markdown';
import { requireInlineImage } from '../util/inlineMedia';
import { readSpriteAssetMetrics, type SpriteAssetMetrics } from '../util/spriteMetrics';
import { WEAPON_IDS } from '../sessions/crossAreaRefs';

export type ParsedDropSpriteVisual = SpriteAssetMetrics &
  Readonly<{
    image: string;
  }>;

export type ParsedDrop = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  ttlMs: number;
  effect: DropEffect;
  spriteVisual: ParsedDropSpriteVisual;
  color: number;
}>;

export type ParsedDropsArea = Readonly<{
  sourcePath: string;
  drops: ReadonlyArray<ParsedDrop>;
}>;

type DropDefinition = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  spriteVisual: ParsedDropSpriteVisual;
  color: number;
}>;

export async function parseDropsArea(sourcePath: string): Promise<ParsedDropsArea> {
  const document = await readMarkdownDocument(sourcePath);
  return parseDropsDocument(document);
}

function parseDropsDocument(document: MarkdownDocument): ParsedDropsArea {
  const dropsSection = requireSection(document, 'Drops');
  const balanceSection = requireSection(document, 'Balance');

  const definitions = dropsSection.sections.map(parseDropDefinition);
  const knownDropIds = new Set(definitions.map((drop) => drop.id));

  const bodySection = requireSection(balanceSection, 'Body');
  const effectSection = requireSection(balanceSection, 'Effect');
  const modifierSection = requireSection(balanceSection, 'Weapon Modifier');

  const bodyTable = requireSingleTable(bodySection);
  const effectTable = requireSingleTable(effectSection);
  const modifierTable = requireSingleTable(modifierSection);

  assertNoForbiddenSpriteColumns(bodySection, bodyTable);
  assertNoForbiddenSpriteColumns(effectSection, effectTable);
  assertNoForbiddenSpriteColumns(modifierSection, modifierTable);
  assertKnownReferences(bodySection, bodyTable, knownDropIds, 'drop');
  assertKnownReferences(effectSection, effectTable, knownDropIds, 'drop');
  assertKnownReferences(modifierSection, modifierTable, knownDropIds, 'drop');

  return {
    sourcePath: document.filePath,
    drops: definitions.map((definition) =>
      parseDrop(definition, {
        bodySection,
        bodyTable,
        effectSection,
        effectTable,
        modifierSection,
        modifierTable
      })
    )
  };
}

function parseDropDefinition(section: MarkdownSection): DropDefinition {
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
    radius: Math.min(metrics.worldSize.width, metrics.worldSize.height) / 2,
    spriteVisual: {
      image: image.url,
      sourceSizePx: metrics.sourceSizePx,
      worldSize: metrics.worldSize
    },
    color: requireFieldHexColor(section, table, 'color')
  };
}

function assertNoForbiddenSpriteFields(section: MarkdownSection, table: MarkdownTable): void {
  for (const row of table.rows) {
    const field = row.cells[0]?.value;
    if (
      field === 'image' ||
      field === 'sourceSizePx' ||
      field === 'worldSize' ||
      field === 'anchor' ||
      field === 'radius'
    ) {
      throw cellError(
        section,
        row.position,
        field,
        'field',
        'sprite fields are derived from the inline image under drop H2'
      );
    }
  }
}

function assertNoForbiddenSpriteColumns(section: MarkdownSection, table: MarkdownTable): void {
  for (const headerCell of table.header) {
    const column = headerCell.value;
    if (
      column === 'image' ||
      column === 'sourceSizePx' ||
      column === 'worldSize' ||
      column === 'anchor' ||
      column === 'radius'
    ) {
      throw cellError(
        section,
        headerCell.position,
        '<header>',
        column,
        'sprite fields are derived from the inline image under drop H2'
      );
    }
  }
}

function parseDrop(
  definition: DropDefinition,
  tables: Readonly<{
    bodySection: MarkdownSection;
    bodyTable: MarkdownTable;
    effectSection: MarkdownSection;
    effectTable: MarkdownTable;
    modifierSection: MarkdownSection;
    modifierTable: MarkdownTable;
  }>
): ParsedDrop {
  const bodyRow = requireRow(tables.bodySection, tables.bodyTable, definition.id);
  const effectRow = requireRow(tables.effectSection, tables.effectTable, definition.id);

  return {
    ...definition,
    ttlMs: parsePositiveNumber(tables.bodySection, tables.bodyTable, bodyRow, 'ttlMs'),
    effect: parseDropEffect(
      tables.effectSection,
      tables.effectTable,
      effectRow,
      tables.modifierSection,
      tables.modifierTable
    )
  };
}

function parseDropEffect(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  modifierSection: MarkdownSection,
  modifierTable: MarkdownTable
): DropEffect {
  const kind = requireCell(section, table, row, 'kind');
  switch (kind) {
    case 'heal':
      return {
        kind,
        amount: parsePositiveNumber(section, table, row, 'value')
      };
    case 'addWeaponModifier':
      return {
        kind,
        target: parseSelectedWeaponTarget(section, table, row),
        modifier: parseWeaponModifier(
          modifierSection,
          modifierTable,
          requireRow(modifierSection, modifierTable, getRowId(row))
        )
      };
    case 'temporaryOverdrive':
      return {
        kind,
        target: parseSelectedWeaponTarget(section, table, row),
        cooldownMultiplier: parsePositiveNumber(section, table, row, 'value'),
        durationMs: parsePositiveNumber(section, table, row, 'durationMs')
      };
    default:
      throw cellError(section, row.position, getRowId(row), 'kind', 'expected heal, addWeaponModifier or temporaryOverdrive');
  }
}

function parseWeaponModifier(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): WeaponModifier {
  const modifierKind = requireCell(section, table, row, 'modifierKind');
  switch (modifierKind) {
    case 'projectileSizeMultiplier':
    case 'projectileSpeedMultiplier':
    case 'symmetricProjectileMultiplier':
      return {
        kind: modifierKind,
        multiplier: parsePositiveNumber(section, table, row, 'value')
      };
    case 'pierceBonus':
      return {
        kind: modifierKind,
        amount: parsePositiveInteger(section, table, row, 'value')
      };
    case 'fragmentExplosion':
      return {
        kind: modifierKind,
        fragmentWeaponArchetypeId: parseKnownWeaponId(section, table, row, 'fragmentWeaponId'),
        count: parsePositiveInteger(section, table, row, 'value'),
        spreadRadians: parseNonNegativeNumber(section, table, row, 'spreadRadians')
      };
    default:
      throw cellError(
        section,
        row.position,
        getRowId(row),
        'modifierKind',
        'expected projectileSizeMultiplier, projectileSpeedMultiplier, symmetricProjectileMultiplier, pierceBonus or fragmentExplosion'
      );
  }
}

function parseKnownWeaponId(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): string {
  const weaponId = parseNonNoneCell(section, table, row, columnName);
  if (!WEAPON_IDS.has(weaponId)) {
    throw cellError(section, row.position, getRowId(row), columnName, `unknown weapon id "${weaponId}"`);
  }
  return weaponId;
}

function parseSelectedWeaponTarget(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): 'selectedWeapon' {
  const target = requireCell(section, table, row, 'target');
  if (target !== 'selectedWeapon') {
    throw cellError(section, row.position, getRowId(row), 'target', 'expected selectedWeapon');
  }
  return target;
}

function parseNonNoneCell(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): string {
  const value = requireCell(section, table, row, columnName);
  if (value === 'none') {
    throw cellError(section, row.position, getRowId(row), columnName, 'expected non-none value');
  }
  return value;
}

function parsePositiveNumber(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): number {
  const value = requireNumber(section, table, row, columnName);
  if (value <= 0) {
    throw cellError(section, row.position, getRowId(row), columnName, 'expected > 0');
  }
  return value;
}

function parseNonNegativeNumber(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): number {
  const value = requireNumber(section, table, row, columnName);
  if (value < 0) {
    throw cellError(section, row.position, getRowId(row), columnName, 'expected >= 0');
  }
  return value;
}

function parsePositiveInteger(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): number {
  const value = parsePositiveNumber(section, table, row, columnName);
  if (!Number.isInteger(value)) {
    throw cellError(section, row.position, getRowId(row), columnName, 'expected integer');
  }
  return value;
}
