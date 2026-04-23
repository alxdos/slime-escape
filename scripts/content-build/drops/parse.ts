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

export type ParsedDropEffect = Readonly<{
  kind: 'heal';
  amount: number;
}>;

export type ParsedDrop = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  ttlMs: number;
  effect: ParsedDropEffect;
  color: number;
}>;

export type ParsedDropsArea = Readonly<{
  drops: ReadonlyArray<ParsedDrop>;
}>;

type DropDefinition = Readonly<{
  id: string;
  displayName: string;
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

  const bodyTable = requireSingleTable(bodySection);
  const effectTable = requireSingleTable(effectSection);

  assertKnownReferences(bodySection, bodyTable, knownDropIds, 'drop');
  assertKnownReferences(effectSection, effectTable, knownDropIds, 'drop');

  return {
    drops: definitions.map((definition) =>
      parseDrop(definition, {
        bodySection,
        bodyTable,
        effectSection,
        effectTable
      })
    )
  };
}

function parseDropDefinition(section: MarkdownSection): DropDefinition {
  const table = requireSingleTable(section);
  return {
    id: section.title,
    displayName: requireField(section, table, 'displayName'),
    color: requireFieldHexColor(section, table, 'color')
  };
}

function parseDrop(
  definition: DropDefinition,
  tables: Readonly<{
    bodySection: MarkdownSection;
    bodyTable: MarkdownTable;
    effectSection: MarkdownSection;
    effectTable: MarkdownTable;
  }>
): ParsedDrop {
  const bodyRow = requireRow(tables.bodySection, tables.bodyTable, definition.id);
  const effectRow = requireRow(tables.effectSection, tables.effectTable, definition.id);

  return {
    ...definition,
    radius: requireNumber(tables.bodySection, tables.bodyTable, bodyRow, 'radius'),
    ttlMs: requireNumber(tables.bodySection, tables.bodyTable, bodyRow, 'ttlMs'),
    effect: parseDropEffect(tables.effectSection, tables.effectTable, effectRow)
  };
}

function parseDropEffect(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): ParsedDropEffect {
  const kind = requireCell(section, table, row, 'kind');
  if (kind !== 'heal') {
    throw cellError(section, row.position, getRowId(row), 'kind', 'expected heal');
  }
  return {
    kind,
    amount: requireNumber(section, table, row, 'amount')
  };
}
