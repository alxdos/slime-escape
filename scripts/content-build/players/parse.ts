import { type MarkdownDocument, type MarkdownSection, type MarkdownTable } from '../parse';
import { requireNumber, requireRow, requireSection } from '../util/require';
import { requireInlineImage } from '../util/inlineMedia';
import {
  assertKnownReferences,
  cellError,
  readMarkdownDocument,
  requireField,
  requireSingleTable,
  sectionError
} from '../util/markdown';
import { readSpriteAssetMetrics, type SpriteAssetMetrics } from '../util/spriteMetrics';

export type ParsedPlayerVisual = Readonly<{
  image: string;
  metrics: SpriteAssetMetrics;
}>;

export type ParsedPlayer = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  maxSpeed: number;
  maxHp: number;
  visual: ParsedPlayerVisual;
}>;

export type ParsedPlayersArea = Readonly<{
  sourcePath: string;
  players: ReadonlyArray<ParsedPlayer>;
}>;

type PlayerDefinition = Readonly<{
  id: string;
  displayName: string;
  visual: ParsedPlayerVisual;
}>;

export async function parsePlayersArea(sourcePath: string): Promise<ParsedPlayersArea> {
  const document = await readMarkdownDocument(sourcePath);
  return parsePlayersDocument(document);
}

function parsePlayersDocument(document: MarkdownDocument): ParsedPlayersArea {
  const playersSection = requireSection(document, 'Players');
  const balanceSection = requireSection(document, 'Balance');

  const definitions = playersSection.sections.map(parsePlayerDefinition);
  const knownPlayerIds = new Set(definitions.map((player) => player.id));

  const movementSection = requireSection(balanceSection, 'Movement');
  const healthSection = requireSection(balanceSection, 'Health');
  assertNoForbiddenBodyGroup(balanceSection);
  assertNoForbiddenVisualGroup(balanceSection);

  const movementTable = requireSingleTable(movementSection);
  const healthTable = requireSingleTable(healthSection);

  assertKnownReferences(movementSection, movementTable, knownPlayerIds, 'player');
  assertKnownReferences(healthSection, healthTable, knownPlayerIds, 'player');

  return {
    sourcePath: document.filePath,
    players: definitions.map((definition) =>
      parsePlayer(definition, {
        movementSection,
        movementTable,
        healthSection,
        healthTable
      })
    )
  };
}

function parsePlayerDefinition(section: MarkdownSection): PlayerDefinition {
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
    visual: {
      image: image.url,
      metrics
    }
  };
}

function parsePlayer(
  definition: PlayerDefinition,
  tables: Readonly<{
    movementSection: MarkdownSection;
    movementTable: MarkdownTable;
    healthSection: MarkdownSection;
    healthTable: MarkdownTable;
  }>
): ParsedPlayer {
  const movementRow = requireRow(tables.movementSection, tables.movementTable, definition.id);
  const healthRow = requireRow(tables.healthSection, tables.healthTable, definition.id);
  const { width, height } = definition.visual.metrics.worldSize;

  return {
    ...definition,
    radius: Math.max(width, height) / 2,
    maxSpeed: requireNumber(tables.movementSection, tables.movementTable, movementRow, 'maxSpeed'),
    maxHp: requireNumber(tables.healthSection, tables.healthTable, healthRow, 'maxHp'),
    visual: definition.visual
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
      field === 'contactBox' ||
      field === 'radius'
    ) {
      throw cellError(
        section,
        row.position,
        field,
        'field',
        'sprite body fields are derived from the inline image under player H2'
      );
    }
  }
}

function assertNoForbiddenBodyGroup(balanceSection: MarkdownSection): void {
  const bodySection = balanceSection.sections.find((section) => section.title === 'Body');
  if (bodySection !== undefined) {
    throw sectionError(
      bodySection,
      'group "## Body" is derived from inline player images; remove manual player radius rows'
    );
  }
}

function assertNoForbiddenVisualGroup(balanceSection: MarkdownSection): void {
  const visualSection = balanceSection.sections.find((section) => section.title === 'Visual');
  if (visualSection !== undefined) {
    throw sectionError(visualSection, 'group "## Visual" is replaced by inline image under player H2');
  }
}
