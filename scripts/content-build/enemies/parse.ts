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
  requireNumber,
  requireRow,
  requireSection
} from '../util/require';
import { requireInlineImage } from '../util/inlineMedia';
import { BUILD_SAMPLE_REGISTRY } from '../util/sampleRegistry';
import {
  expandSetToMembers,
  parseSampleIdCellGroup,
  parseSharedResourceSetPartition,
  type SharedResourceSetPartition
} from '../util/sharedResourceSet';
import { DROP_IDS } from '../sessions/crossAreaRefs';

export type ParsedEnemyBehavior = 'stationary' | 'chase';

export type ParsedDropTableEntry = Readonly<{
  archetypeId: string;
  chance: number;
}>;

export type ParsedCarrierDropMetadata = Readonly<{
  marker: 'reward';
  guaranteedDropArchetypeIds: ReadonlyArray<string>;
}>;

export type ParsedRetaliationPolicy = Readonly<{
  enabled: boolean;
  durationMs: number;
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
  carrierDrop: ParsedCarrierDropMetadata | null;
  retaliation: ParsedRetaliationPolicy;
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
  visual: ParsedEnemyVisual;
}>;

const SOUND_SET_MEMBERS_GROUP = 'Members';
const SOUND_SET_GROUPS = ['Hit', 'Death', 'Voice'] as const;
const SOUND_SET_SECTIONS = [SOUND_SET_MEMBERS_GROUP, ...SOUND_SET_GROUPS] as const;
const SOUND_SET_SAMPLE_COLUMNS = ['s1', 's2', 's3', 's4'] as const;
const ENEMY_VOICE_INTERVAL_MIN_MS = 3000;
const ENEMY_VOICE_INTERVAL_MAX_MS = 6000;

export async function parseEnemiesArea(sourcePath: string): Promise<ParsedEnemiesArea> {
  const document = await readEnemiesDocument(sourcePath);
  return parseEnemiesDocument(document);
}

function parseEnemiesDocument(document: MarkdownDocument): ParsedEnemiesArea {
  const enemiesSection = requireSection(document, 'Enemies');
  const balanceSection = requireSection(document, 'Balance');
  const soundSetsSection = requireSection(document, 'Sound sets');

  const definitions = enemiesSection.sections.map(parseEnemyDefinition);
  const knownEnemyIds = new Set(definitions.map((enemy) => enemy.id));
  const audioByEnemyId = parseSoundSets(soundSetsSection, knownEnemyIds, document.filePath);

  const bodySection = requireSection(balanceSection, 'Body');
  const movementSection = requireSection(balanceSection, 'Movement');
  const contactSection = requireSection(balanceSection, 'Contact damage');
  const knockbackSection = requireSection(balanceSection, 'Knockback');
  const dropsSection = requireSection(balanceSection, 'Drops');
  const carrierDropsSection = requireSection(balanceSection, 'Carrier Drops');
  const retaliationSection = requireSection(balanceSection, 'Retaliation');
  assertNoForbiddenVisualGroup(balanceSection);
  assertNoForbiddenAudioGroups(balanceSection);

  const bodyTable = requireSingleTable(bodySection);
  const movementTable = requireSingleTable(movementSection);
  const contactTable = requireSingleTable(contactSection);
  const knockbackTable = requireSingleTable(knockbackSection);
  const dropsTable = requireSingleTable(dropsSection);
  const carrierDropsTable = requireSingleTable(carrierDropsSection);
  const retaliationTable = requireSingleTable(retaliationSection);

  assertKnownReferences(bodySection, bodyTable, knownEnemyIds);
  assertKnownReferences(movementSection, movementTable, knownEnemyIds);
  assertKnownReferences(contactSection, contactTable, knownEnemyIds);
  assertKnownReferences(knockbackSection, knockbackTable, knownEnemyIds);
  assertKnownReferences(dropsSection, dropsTable, knownEnemyIds);
  assertKnownReferences(carrierDropsSection, carrierDropsTable, knownEnemyIds);
  assertKnownReferences(retaliationSection, retaliationTable, knownEnemyIds);

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
        carrierDropsSection,
        carrierDropsTable,
        retaliationSection,
        retaliationTable,
        audioByEnemyId
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
    color: requireFieldHexColor(section, table, 'color'),
    visual: {
      image: requireInlineImage(section).url
    }
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
    carrierDropsSection: MarkdownSection;
    carrierDropsTable: MarkdownTable;
    retaliationSection: MarkdownSection;
    retaliationTable: MarkdownTable;
    audioByEnemyId: ReadonlyMap<string, ParsedEnemyAudio>;
  }>
): ParsedEnemy {
  const bodyRow = requireRow(tables.bodySection, tables.bodyTable, definition.id);
  const movementRow = requireRow(tables.movementSection, tables.movementTable, definition.id);
  const contactRow = requireRow(tables.contactSection, tables.contactTable, definition.id);
  const knockbackRow = requireRow(tables.knockbackSection, tables.knockbackTable, definition.id);
  const dropRows = findRowsById(tables.dropsSection, tables.dropsTable, definition.id);
  const carrierDropRow = requireRow(tables.carrierDropsSection, tables.carrierDropsTable, definition.id);
  const retaliationRow = requireRow(tables.retaliationSection, tables.retaliationTable, definition.id);
  const audio = tables.audioByEnemyId.get(definition.id);
  if (audio === undefined) {
    throw sectionError(
      tables.dropsSection,
      `enemy "${definition.id}" is missing expanded sound-set audio`
    );
  }

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
    carrierDrop: parseCarrierDrop(tables.carrierDropsSection, tables.carrierDropsTable, carrierDropRow),
    retaliation: parseRetaliation(tables.retaliationSection, tables.retaliationTable, retaliationRow),
    audio,
    visual: definition.visual
  };
}

function parseCarrierDrop(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): ParsedCarrierDropMetadata | null {
  const raw = requireCell(section, table, row, 'guaranteedDropArchetypeIds');
  if (raw === 'none') return null;
  const guaranteedDropArchetypeIds = raw.split(',').map((part) => part.trim());
  if (
    guaranteedDropArchetypeIds.length === 0 ||
    guaranteedDropArchetypeIds.some((id) => id.length === 0)
  ) {
    throw cellError(
      section,
      row.position,
      getRowId(row),
      'guaranteedDropArchetypeIds',
      'expected comma-separated drop ids or none'
    );
  }
  for (const dropArchetypeId of guaranteedDropArchetypeIds) {
    if (!DROP_IDS.has(dropArchetypeId)) {
      throw cellError(
        section,
        row.position,
        getRowId(row),
        'guaranteedDropArchetypeIds',
        `unknown drop id "${dropArchetypeId}"`
      );
    }
  }
  return {
    marker: 'reward',
    guaranteedDropArchetypeIds
  };
}

function parseRetaliation(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): ParsedRetaliationPolicy {
  const enabled = parseBoolean(section, table, row, 'enabled');
  const durationMs = requireNumber(section, table, row, 'durationMs');
  if (enabled && durationMs <= 0) {
    throw cellError(section, row.position, getRowId(row), 'durationMs', 'expected > 0 when enabled');
  }
  return { enabled, durationMs };
}

function parseBoolean(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): boolean {
  const raw = requireCell(section, table, row, columnName);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw cellError(section, row.position, getRowId(row), columnName, 'expected true or false');
}

function assertNoForbiddenVisualGroup(balanceSection: MarkdownSection): void {
  const visualSection = balanceSection.sections.find((section) => section.title === 'Visual');
  if (visualSection !== undefined) {
    throw sectionError(visualSection, 'group "## Visual" is replaced by inline image under enemy H2');
  }
}

function assertNoForbiddenAudioGroups(balanceSection: MarkdownSection): void {
  for (const groupName of ['Sounds', 'Voice']) {
    const section = balanceSection.sections.find((candidate) => candidate.title === groupName);
    if (section !== undefined) {
      throw sectionError(section, `group "## ${groupName}" is replaced by # Sound sets`);
    }
  }
}

function parseSoundSets(
  soundSetsSection: MarkdownSection,
  knownEnemyIds: ReadonlySet<string>,
  sourcePath: string
): ReadonlyMap<string, ParsedEnemyAudio> {
  assertSoundSetShape(soundSetsSection);

  const partition = parseSharedResourceSetPartition(soundSetsSection, {
    archetypeIds: knownEnemyIds,
    membersColumnName: 'slimes',
    requiredGroups: SOUND_SET_GROUPS
  });

  const hitBySet = parseSoundSetSampleGroup(partition, 'Hit', sourcePath);
  const deathBySet = parseSoundSetSampleGroup(partition, 'Death', sourcePath);
  const voiceBySet = parseSoundSetSampleGroup(partition, 'Voice', sourcePath);
  const hitByEnemy = expandSetToMembers(partition.members, hitBySet);
  const deathByEnemy = expandSetToMembers(partition.members, deathBySet);
  const voiceByEnemy = expandSetToMembers(partition.members, voiceBySet);

  const audioByEnemyId = new Map<string, ParsedEnemyAudio>();
  for (const [enemyId] of partition.members) {
    audioByEnemyId.set(enemyId, {
      hit: requireExpandedSampleIds(hitByEnemy, enemyId, 'Hit'),
      death: requireExpandedSampleIds(deathByEnemy, enemyId, 'Death'),
      voice: {
        sampleIds: requireExpandedSampleIds(voiceByEnemy, enemyId, 'Voice'),
        intervalMinMs: ENEMY_VOICE_INTERVAL_MIN_MS,
        intervalMaxMs: ENEMY_VOICE_INTERVAL_MAX_MS
      }
    });
  }
  return audioByEnemyId;
}

function parseSoundSetSampleGroup(
  partition: SharedResourceSetPartition,
  groupName: (typeof SOUND_SET_GROUPS)[number],
  sourcePath: string
): ReadonlyMap<string, ReadonlyArray<string>> {
  const group = partition.groups.get(groupName);
  if (group === undefined) {
    throw new Error(`sound-set required group "${groupName}" was not parsed`);
  }
  return parseSampleIdCellGroup(groupName, group, BUILD_SAMPLE_REGISTRY, { sourcePath }).sampleIdsBySetId;
}

function assertSoundSetShape(soundSetsSection: MarkdownSection): void {
  const expectedSections = new Set<string>(SOUND_SET_SECTIONS);
  const seenSections = new Set<string>();
  for (const section of soundSetsSection.sections) {
    if (!expectedSections.has(section.title)) {
      throw sectionError(section, `unexpected sound-set section "## ${section.title}"`);
    }
    if (seenSections.has(section.title)) {
      throw sectionError(section, `duplicate sound-set section "## ${section.title}"`);
    }
    seenSections.add(section.title);
  }

  for (const sectionName of SOUND_SET_SECTIONS) {
    if (!seenSections.has(sectionName)) {
      throw sectionError(soundSetsSection, `expected sound-set section "## ${sectionName}"`);
    }
  }
  if (soundSetsSection.sections[0]?.title !== SOUND_SET_MEMBERS_GROUP) {
    throw sectionError(soundSetsSection, 'expected "## Members" to be the first sound-set section');
  }

  const membersSection = requireSection(soundSetsSection, SOUND_SET_MEMBERS_GROUP);
  const membersTable = requireSingleTable(membersSection);
  requireExactHeader(membersSection, membersTable, ['setId', 'slimes']);

  for (const groupName of SOUND_SET_GROUPS) {
    const groupSection = requireSection(soundSetsSection, groupName);
    const groupTable = requireSingleTable(groupSection);
    requireExactHeader(groupSection, groupTable, ['setId', ...SOUND_SET_SAMPLE_COLUMNS]);
  }
}

function requireExactHeader(
  section: MarkdownSection,
  table: MarkdownTable,
  expectedHeader: ReadonlyArray<string>
): void {
  const actualHeader = table.header.map((cell) => cell.value);
  if (
    actualHeader.length !== expectedHeader.length ||
    actualHeader.some((value, index) => value !== expectedHeader[index])
  ) {
    throw cellError(
      section,
      table.position,
      '<header>',
      expectedHeader.join(' | '),
      `expected header "${expectedHeader.join(' | ')}"`
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
    if (!DROP_IDS.has(archetypeId)) {
      throw cellError(
        section,
        row.position,
        getRowId(row),
        'dropArchetypeId',
        `unknown drop id "${archetypeId}"`
      );
    }
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

function requireExpandedSampleIds(
  samplesByEnemy: ReadonlyMap<string, ReadonlyArray<string>>,
  enemyId: string,
  groupName: string
): ReadonlyArray<string> {
  const sampleIds = samplesByEnemy.get(enemyId);
  if (sampleIds === undefined) {
    throw new Error(`enemy "${enemyId}" is missing expanded "${groupName}" sample ids`);
  }
  return sampleIds;
}

function sectionLabel(section: MarkdownSection): string {
  return `${'#'.repeat(section.depth)} ${section.title}`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
