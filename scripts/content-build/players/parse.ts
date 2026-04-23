import { type MarkdownDocument, type MarkdownSection, type MarkdownTable } from '../parse';
import { requireCell, requireNumber, requireRow, requireSection } from '../util/require';
import {
  assertKnownReferences,
  cellError,
  readMarkdownDocument,
  requireField,
  requireSingleTable
} from '../util/markdown';

export type ParsedPlayerVisual = Readonly<{
  image: string;
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
}>;

const FORBIDDEN_VISUAL_COLUMNS = new Set([
  'sourceSizePx',
  'displayWidthPx',
  'displayHeightPx',
  'displaySizePx',
  'worldSize'
]);

export async function parsePlayersArea(sourcePath: string): Promise<ParsedPlayersArea> {
  const document = await readMarkdownDocument(sourcePath);
  return parsePlayersDocument(document);
}

function parsePlayersDocument(document: MarkdownDocument): ParsedPlayersArea {
  const playersSection = requireSection(document, 'Players');
  const balanceSection = requireSection(document, 'Balance');

  const definitions = playersSection.sections.map(parsePlayerDefinition);
  const knownPlayerIds = new Set(definitions.map((player) => player.id));

  const bodySection = requireSection(balanceSection, 'Body');
  const movementSection = requireSection(balanceSection, 'Movement');
  const healthSection = requireSection(balanceSection, 'Health');
  const visualSection = requireSection(balanceSection, 'Visual');

  const bodyTable = requireSingleTable(bodySection);
  const movementTable = requireSingleTable(movementSection);
  const healthTable = requireSingleTable(healthSection);
  const visualTable = requireSingleTable(visualSection);

  assertKnownReferences(bodySection, bodyTable, knownPlayerIds, 'player');
  assertKnownReferences(movementSection, movementTable, knownPlayerIds, 'player');
  assertKnownReferences(healthSection, healthTable, knownPlayerIds, 'player');
  assertKnownReferences(visualSection, visualTable, knownPlayerIds, 'player');
  assertNoForbiddenVisualColumns(visualSection, visualTable);

  return {
    sourcePath: document.filePath,
    players: definitions.map((definition) =>
      parsePlayer(definition, {
        bodySection,
        bodyTable,
        movementSection,
        movementTable,
        healthSection,
        healthTable,
        visualSection,
        visualTable
      })
    )
  };
}

function parsePlayerDefinition(section: MarkdownSection): PlayerDefinition {
  const table = requireSingleTable(section);
  return {
    id: section.title,
    displayName: requireField(section, table, 'displayName')
  };
}

function parsePlayer(
  definition: PlayerDefinition,
  tables: Readonly<{
    bodySection: MarkdownSection;
    bodyTable: MarkdownTable;
    movementSection: MarkdownSection;
    movementTable: MarkdownTable;
    healthSection: MarkdownSection;
    healthTable: MarkdownTable;
    visualSection: MarkdownSection;
    visualTable: MarkdownTable;
  }>
): ParsedPlayer {
  const bodyRow = requireRow(tables.bodySection, tables.bodyTable, definition.id);
  const movementRow = requireRow(tables.movementSection, tables.movementTable, definition.id);
  const healthRow = requireRow(tables.healthSection, tables.healthTable, definition.id);
  const visualRow = requireRow(tables.visualSection, tables.visualTable, definition.id);

  return {
    ...definition,
    radius: requireNumber(tables.bodySection, tables.bodyTable, bodyRow, 'radius'),
    maxSpeed: requireNumber(tables.movementSection, tables.movementTable, movementRow, 'maxSpeed'),
    maxHp: requireNumber(tables.healthSection, tables.healthTable, healthRow, 'maxHp'),
    visual: {
      image: requireCell(tables.visualSection, tables.visualTable, visualRow, 'image')
    }
  };
}

function assertNoForbiddenVisualColumns(section: MarkdownSection, table: MarkdownTable): void {
  for (const header of table.header) {
    if (!FORBIDDEN_VISUAL_COLUMNS.has(header.value)) continue;
    throw cellError(
      section,
      header.position,
      '<header>',
      header.value,
      'derive visual field is generated from the PNG asset'
    );
  }
}
