import {
  parseMarkdownFile,
  type MarkdownDocument,
  type MarkdownSection,
  type MarkdownTable,
  type MarkdownTableRow,
  type SourcePosition
} from '../parse';
import {
  ContentBuildError,
  requireCell,
  requireHexColor,
  requireNumber,
  requireRow,
  requireSampleIdList,
  requireSection
} from '../util/require';

export type ParsedEnemyBehavior = 'stationary' | 'chase';

export type ParsedDropTableEntry = Readonly<{
  archetypeId: string;
  chance: number;
}>;

export type ParsedEnemyAudio = Readonly<{
  hit: ReadonlyArray<string>;
  death: ReadonlyArray<string>;
  voice: ParsedEnemyVoice | null;
}>;

export type ParsedEnemyVisual = Readonly<{
  image: string;
}>;

export type ParsedEnemyVoice = Readonly<{
  sampleIds: ReadonlyArray<string>;
  intervalMinMs: number;
  intervalMaxMs: number;
}>;

export type ParsedEnemy = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  maxHp: number;
  behavior: ParsedEnemyBehavior;
  maxSpeed: number;
  contactDamage: number;
  contactCooldownMs: number;
  knockbackBaseImpulse: number;
  knockbackVelocityScale: number;
  knockbackDurationMs: number;
  color: number;
  dropTable: ReadonlyArray<ParsedDropTableEntry>;
  audio: ParsedEnemyAudio;
  visual: ParsedEnemyVisual;
}>;

export type ParsedEnemiesArea = Readonly<{
  sourcePath: string;
  enemies: ReadonlyArray<ParsedEnemy>;
}>;

type EnemyDefinition = Readonly<{
  id: string;
  displayName: string;
  color: number;
}>;

const FORBIDDEN_VISUAL_COLUMNS = new Set([
  'sourceSizePx',
  'displayWidthPx',
  'displayHeightPx',
  'displaySizePx',
  'worldSize'
]);

export async function parseEnemiesArea(sourcePath: string): Promise<ParsedEnemiesArea> {
  const document = await readEnemiesDocument(sourcePath);
  return parseEnemiesDocument(document);
}

function parseEnemiesDocument(document: MarkdownDocument): ParsedEnemiesArea {
  const enemiesSection = requireSection(document, 'Enemies');
  const balanceSection = requireSection(document, 'Balance');

  const definitions = enemiesSection.sections.map(parseEnemyDefinition);
  const knownEnemyIds = new Set(definitions.map((enemy) => enemy.id));

  const bodySection = requireSection(balanceSection, 'Body');
  const movementSection = requireSection(balanceSection, 'Movement');
  const contactSection = requireSection(balanceSection, 'Contact damage');
  const knockbackSection = requireSection(balanceSection, 'Knockback');
  const dropsSection = requireSection(balanceSection, 'Drops');
  const soundsSection = requireSection(balanceSection, 'Sounds');
  const voiceSection = requireSection(balanceSection, 'Voice');
  const visualSection = requireSection(balanceSection, 'Visual');

  const bodyTable = requireSingleTable(bodySection);
  const movementTable = requireSingleTable(movementSection);
  const contactTable = requireSingleTable(contactSection);
  const knockbackTable = requireSingleTable(knockbackSection);
  const dropsTable = requireSingleTable(dropsSection);
  const soundsTable = requireSingleTable(soundsSection);
  const voiceTable = requireSingleTable(voiceSection);
  const visualTable = requireSingleTable(visualSection);

  assertKnownReferences(bodySection, bodyTable, knownEnemyIds);
  assertKnownReferences(movementSection, movementTable, knownEnemyIds);
  assertKnownReferences(contactSection, contactTable, knownEnemyIds);
  assertKnownReferences(knockbackSection, knockbackTable, knownEnemyIds);
  assertKnownReferences(dropsSection, dropsTable, knownEnemyIds);
  assertKnownReferences(soundsSection, soundsTable, knownEnemyIds);
  assertKnownReferences(voiceSection, voiceTable, knownEnemyIds);
  assertKnownReferences(visualSection, visualTable, knownEnemyIds);
  assertNoForbiddenVisualColumns(visualSection, visualTable);

  return {
    sourcePath: document.filePath,
    enemies: definitions.map((definition) =>
      parseEnemy(definition, {
        bodySection,
        bodyTable,
        movementSection,
        movementTable,
        contactSection,
        contactTable,
        knockbackSection,
        knockbackTable,
        dropsSection,
        dropsTable,
        soundsSection,
        soundsTable,
        voiceSection,
        voiceTable,
        visualSection,
        visualTable
      })
    )
  };
}

async function readEnemiesDocument(sourcePath: string): Promise<MarkdownDocument> {
  try {
    return await parseMarkdownFile(sourcePath);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new ContentBuildError(`${sourcePath}: source not found`);
    }
    throw error;
  }
}

function parseEnemyDefinition(section: MarkdownSection): EnemyDefinition {
  const table = requireSingleTable(section);
  return {
    id: section.title,
    displayName: requireField(section, table, 'displayName'),
    color: requireFieldHexColor(section, table, 'color')
  };
}

function parseEnemy(
  definition: EnemyDefinition,
  tables: Readonly<{
    bodySection: MarkdownSection;
    bodyTable: MarkdownTable;
    movementSection: MarkdownSection;
    movementTable: MarkdownTable;
    contactSection: MarkdownSection;
    contactTable: MarkdownTable;
    knockbackSection: MarkdownSection;
    knockbackTable: MarkdownTable;
    dropsSection: MarkdownSection;
    dropsTable: MarkdownTable;
    soundsSection: MarkdownSection;
    soundsTable: MarkdownTable;
    voiceSection: MarkdownSection;
    voiceTable: MarkdownTable;
    visualSection: MarkdownSection;
    visualTable: MarkdownTable;
  }>
): ParsedEnemy {
  const bodyRow = requireRow(tables.bodySection, tables.bodyTable, definition.id);
  const movementRow = requireRow(tables.movementSection, tables.movementTable, definition.id);
  const contactRow = requireRow(tables.contactSection, tables.contactTable, definition.id);
  const knockbackRow = requireRow(tables.knockbackSection, tables.knockbackTable, definition.id);
  const soundsRow = requireRow(tables.soundsSection, tables.soundsTable, definition.id);
  const dropRows = findRowsById(tables.dropsSection, tables.dropsTable, definition.id);
  const voiceRow = findRowById(tables.voiceSection, tables.voiceTable, definition.id);
  const visualRow = requireRow(tables.visualSection, tables.visualTable, definition.id);

  return {
    ...definition,
    radius: requireNumber(tables.bodySection, tables.bodyTable, bodyRow, 'radius'),
    maxHp: requireNumber(tables.bodySection, tables.bodyTable, bodyRow, 'maxHp'),
    behavior: requireBehavior(tables.bodySection, tables.bodyTable, bodyRow),
    maxSpeed: requireNumber(tables.movementSection, tables.movementTable, movementRow, 'maxSpeed'),
    contactDamage: requireNumber(
      tables.contactSection,
      tables.contactTable,
      contactRow,
      'contactDamage'
    ),
    contactCooldownMs: requireNumber(
      tables.contactSection,
      tables.contactTable,
      contactRow,
      'contactCooldownMs'
    ),
    knockbackBaseImpulse: requireNumber(
      tables.knockbackSection,
      tables.knockbackTable,
      knockbackRow,
      'baseImpulse'
    ),
    knockbackVelocityScale: requireNumber(
      tables.knockbackSection,
      tables.knockbackTable,
      knockbackRow,
      'velocityScale'
    ),
    knockbackDurationMs: requireNumber(
      tables.knockbackSection,
      tables.knockbackTable,
      knockbackRow,
      'durationMs'
    ),
    dropTable: parseDropTable(tables.dropsSection, tables.dropsTable, dropRows),
    audio: {
      hit: readOptionalSampleIdList(tables.soundsSection, tables.soundsTable, soundsRow, 'hit'),
      death: readOptionalSampleIdList(tables.soundsSection, tables.soundsTable, soundsRow, 'death'),
      voice: voiceRow === null ? null : parseVoice(tables.voiceSection, tables.voiceTable, voiceRow)
    },
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

function parseDropTable(
  section: MarkdownSection,
  table: MarkdownTable,
  rows: ReadonlyArray<MarkdownTableRow>
): ReadonlyArray<ParsedDropTableEntry> {
  const seenPairs = new Set<string>();
  return rows.map((row) => {
    const archetypeId = requireCell(section, table, row, 'dropArchetypeId');
    const pairKey = `${getRowId(row)}\u0000${archetypeId}`;
    if (seenPairs.has(pairKey)) {
      throw cellError(
        section,
        row.position,
        getRowId(row),
        'dropArchetypeId',
        `duplicate drop pair "${getRowId(row)}" + "${archetypeId}"`
      );
    }
    seenPairs.add(pairKey);

    return {
      archetypeId,
      chance: requireNumber(section, table, row, 'chance')
    };
  });
}

function parseVoice(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): ParsedEnemyVoice {
  return {
    sampleIds: requireSampleIdList(section, table, row, 'sampleIds'),
    intervalMinMs: requireNumber(section, table, row, 'intervalMinMs'),
    intervalMaxMs: requireNumber(section, table, row, 'intervalMaxMs')
  };
}

function requireBehavior(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): ParsedEnemyBehavior {
  const behavior = requireCell(section, table, row, 'behavior');
  if (behavior === 'stationary' || behavior === 'chase') {
    return behavior;
  }
  throw cellError(section, row.position, getRowId(row), 'behavior', 'expected stationary or chase');
}

function requireSingleTable(section: MarkdownSection): MarkdownTable {
  const table = section.tables[0];
  if (table === undefined) {
    throw sectionError(section, 'expected a GFM table');
  }
  if (section.tables.length > 1) {
    throw sectionError(section, 'expected exactly one GFM table');
  }
  return table;
}

function requireField(section: MarkdownSection, table: MarkdownTable, fieldName: string): string {
  requireFieldValueHeader(section, table);
  const row = findFieldRow(table, fieldName);
  if (row === null) {
    throw cellError(section, section.position, fieldName, 'value', `expected field "${fieldName}"`);
  }
  const value = row.cells[1]?.value;
  if (value === undefined || value.length === 0) {
    throw cellError(section, row.position, fieldName, 'value', 'expected non-empty value');
  }
  return value;
}

function requireFieldHexColor(section: MarkdownSection, table: MarkdownTable, fieldName: string): number {
  const raw = requireField(section, table, fieldName);
  const row = findFieldRow(table, fieldName);
  const match = /^#(?<hex>[0-9a-fA-F]{6})$/.exec(raw);
  if (match?.groups?.hex === undefined) {
    throw cellError(section, row?.position ?? section.position, fieldName, 'value', 'expected #RRGGBB color');
  }
  return Number.parseInt(match.groups.hex, 16);
}

function requireFieldValueHeader(section: MarkdownSection, table: MarkdownTable): void {
  if (table.header[0]?.value !== 'field' || table.header[1]?.value !== 'value') {
    throw cellError(section, table.position, '<header>', 'field/value', 'expected field/value table');
  }
}

function findFieldRow(table: MarkdownTable, fieldName: string): MarkdownTableRow | null {
  return table.rows.find((row) => row.cells[0]?.value === fieldName) ?? null;
}

function findRowById(
  section: MarkdownSection,
  table: MarkdownTable,
  id: string
): MarkdownTableRow | null {
  requireIdHeader(section, table);
  return table.rows.find((row) => getRowId(row) === id) ?? null;
}

function findRowsById(
  section: MarkdownSection,
  table: MarkdownTable,
  id: string
): ReadonlyArray<MarkdownTableRow> {
  requireIdHeader(section, table);
  return table.rows.filter((row) => getRowId(row) === id);
}

function assertKnownReferences(
  section: MarkdownSection,
  table: MarkdownTable,
  knownEnemyIds: ReadonlySet<string>
): void {
  requireIdHeader(section, table);
  for (const row of table.rows) {
    const rowId = getRowId(row);
    if (!knownEnemyIds.has(rowId)) {
      throw cellError(section, row.position, rowId, 'id', `unknown enemy id "${rowId}"`);
    }
  }
}

function readOptionalSampleIdList(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): ReadonlyArray<string> {
  const columnIndex = table.header.findIndex((cell) => cell.value === columnName);
  if (columnIndex < 0) {
    throw cellError(section, row.position, getRowId(row), columnName, `expected column "${columnName}"`);
  }
  const raw = row.cells[columnIndex]?.value ?? '';
  if (raw.length === 0) {
    return [];
  }
  return requireSampleIdList(section, table, row, columnName);
}

function requireIdHeader(section: MarkdownSection, table: MarkdownTable): void {
  if (table.header[0]?.value !== 'id') {
    throw cellError(section, table.position, '<header>', 'id', 'expected first column "id"');
  }
}

function getRowId(row: MarkdownTableRow): string {
  return row.cells[0]?.value ?? '<missing id>';
}

function sectionError(section: MarkdownSection, expected: string): ContentBuildError {
  return new ContentBuildError(
    `${section.filePath}:${section.position.line}:${section.position.column}: section "${sectionLabel(
      section
    )}": ${expected}`
  );
}

function cellError(
  section: MarkdownSection,
  position: SourcePosition,
  rowId: string,
  columnName: string,
  expected: string
): ContentBuildError {
  return new ContentBuildError(
    `${section.filePath}:${position.line}:${position.column}: section "${sectionLabel(
      section
    )}" row "${rowId}" column "${columnName}": ${expected}`
  );
}

function sectionLabel(section: MarkdownSection): string {
  return `${'#'.repeat(section.depth)} ${section.title}`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
