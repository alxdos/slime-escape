import { type MarkdownDocument, type MarkdownSection, type MarkdownTable } from '../parse';
import { requireNumber, requireRow, requireSection } from '../util/require';
import { requireInlineImage } from '../util/inlineMedia';
import {
  assertKnownReferences,
  readMarkdownDocument,
  requireField,
  requireSingleTable,
  sectionError
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

  const bodySection = requireSection(balanceSection, 'Body');
  const movementSection = requireSection(balanceSection, 'Movement');
  const healthSection = requireSection(balanceSection, 'Health');
  assertNoForbiddenVisualGroup(balanceSection);

  const bodyTable = requireSingleTable(bodySection);
  const movementTable = requireSingleTable(movementSection);
  const healthTable = requireSingleTable(healthSection);

  assertKnownReferences(bodySection, bodyTable, knownPlayerIds, 'player');
  assertKnownReferences(movementSection, movementTable, knownPlayerIds, 'player');
  assertKnownReferences(healthSection, healthTable, knownPlayerIds, 'player');

  return {
    sourcePath: document.filePath,
    players: definitions.map((definition) =>
      parsePlayer(definition, {
        bodySection,
        bodyTable,
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
  return {
    id: section.title,
    displayName: requireField(section, table, 'displayName'),
    visual: {
      image: requireInlineImage(section).url
    }
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
  }>
): ParsedPlayer {
  const bodyRow = requireRow(tables.bodySection, tables.bodyTable, definition.id);
  const movementRow = requireRow(tables.movementSection, tables.movementTable, definition.id);
  const healthRow = requireRow(tables.healthSection, tables.healthTable, definition.id);

  return {
    ...definition,
    radius: requireNumber(tables.bodySection, tables.bodyTable, bodyRow, 'radius'),
    maxSpeed: requireNumber(tables.movementSection, tables.movementTable, movementRow, 'maxSpeed'),
    maxHp: requireNumber(tables.healthSection, tables.healthTable, healthRow, 'maxHp'),
    visual: definition.visual
  };
}

function assertNoForbiddenVisualGroup(balanceSection: MarkdownSection): void {
  const visualSection = balanceSection.sections.find((section) => section.title === 'Visual');
  if (visualSection !== undefined) {
    throw sectionError(visualSection, 'group "## Visual" is replaced by inline image under player H2');
  }
}
