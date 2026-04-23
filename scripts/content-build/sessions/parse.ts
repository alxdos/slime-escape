import { readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

import type {
  EncounterType,
  LossCondition,
  TransitionNext,
  WinCondition,
  ZoneBehavior
} from '../../../src/shared/session';
import {
  type MarkdownDocument,
  type MarkdownSection,
  type MarkdownTable,
  type MarkdownTableRow
} from '../parse';
import { ContentBuildError, requireNumber, requireSection } from '../util/require';
import {
  cellError,
  getRowId,
  readMarkdownDocument,
  requireField,
  requireSingleTable,
  sectionError
} from '../util/markdown';
import { toConstName } from '../util/render';

export type ParsedRef = Readonly<{
  id: string;
  constName: string;
}>;

export type ParsedWinCondition = WinCondition;
export type ParsedLossCondition = LossCondition;

export type ParsedSpawnPlan =
  | Readonly<{ kind: 'empty' }>
  | Readonly<{
      kind: 'wave';
      spawns: ReadonlyArray<Readonly<{ archetype: ParsedRef }>>;
      spawnIntervalMs: number;
      maxAlive: number;
      edgeMargin: number;
    }>
  | Readonly<{
      kind: 'static';
      spawns: ReadonlyArray<Readonly<{ archetype: ParsedRef; position: Readonly<{ x: number; y: number }> }>>;
    }>
  | Readonly<{
      kind: 'boss';
      bossArchetype: ParsedRef;
      position: 'top-center';
      bossEdgeMargin: number;
    }>;

export type ParsedTransitionRules =
  | Readonly<{ kind: 'never'; next: TransitionNext }>
  | Readonly<{ kind: 'allEnemiesCleared'; next: TransitionNext }>
  | Readonly<{ kind: 'timer'; durationMs: number; next: TransitionNext }>;

export type ParsedEncounter = Readonly<{
  id: string;
  type: EncounterType;
  spawnPlan: ParsedSpawnPlan;
  zoneBehavior: ZoneBehavior;
  transitionRules: ParsedTransitionRules;
}>;

export type ParsedSessionPreset = Readonly<{
  sourcePath: string;
  presetId: string;
  displayName: string;
  description: string;
  visibleInMenu: boolean;
  order: number;
  arena: ParsedRef;
  player: ParsedRef;
  loadoutWeapon: ParsedRef | null;
  winCondition: ParsedWinCondition;
  lossCondition: ParsedLossCondition;
  encounters: ReadonlyArray<ParsedEncounter>;
}>;

export type ParsedSessionsArea = Readonly<{
  sourceDirectory: string;
  presets: ReadonlyArray<ParsedSessionPreset>;
}>;

type SpawnKind = ParsedSpawnPlan['kind'];
type ZoneKind = ZoneBehavior['kind'];
type TransitionKind = ParsedTransitionRules['kind'];

type EncounterTables = Readonly<{
  fields: MarkdownTable;
  spawns: MarkdownTable | null;
}>;

type FieldReader = Readonly<{
  section: MarkdownSection;
  table: MarkdownTable;
  read(fieldName: string): string;
  readNumber(fieldName: string): number;
}>;

export async function parseSessionsArea(sourceDirectory: string): Promise<ParsedSessionsArea> {
  const sourcePaths = await listSessionMarkdownFiles(sourceDirectory);
  return {
    sourceDirectory,
    presets: await Promise.all(sourcePaths.map(parseSessionFile))
  };
}

async function listSessionMarkdownFiles(sourceDirectory: string): Promise<ReadonlyArray<string>> {
  let entries;
  try {
    entries = await readdir(sourceDirectory, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new ContentBuildError(`${sourceDirectory}: source directory not found`);
    }
    throw error;
  }

  const sourcePaths = entries
    .filter((entry) => entry.isFile() && extname(entry.name) === '.md')
    .map((entry) => join(sourceDirectory, entry.name))
    .sort((left, right) => left.localeCompare(right));

  if (sourcePaths.length === 0) {
    throw new ContentBuildError(`${sourceDirectory}: expected at least one .md source file`);
  }

  return sourcePaths;
}

async function parseSessionFile(sourcePath: string): Promise<ParsedSessionPreset> {
  const document = await readMarkdownDocument(sourcePath);
  return parseSessionDocument(document, presetIdFromSourcePath(sourcePath));
}

function parseSessionDocument(document: MarkdownDocument, presetId: string): ParsedSessionPreset {
  const sessionSection = requireSection(document, 'Session');
  const encountersSection = requireSection(document, 'Encounters');
  const sessionTable = requireSingleTable(sessionSection);
  const sessionFields = fieldReader(sessionSection, sessionTable);

  return {
    sourcePath: document.filePath,
    presetId,
    displayName: sessionFields.read('displayName'),
    description: sessionFields.read('description'),
    visibleInMenu: parseBooleanField(sessionFields, 'visibleInMenu'),
    order: sessionFields.readNumber('order'),
    arena: arenaRef(sessionFields.read('arenaId')),
    player: playerRef(sessionFields.read('playerId')),
    loadoutWeapon: parseLoadoutWeapon(sessionFields.read('loadoutWeaponId')),
    winCondition: parseWinCondition(sessionFields, 'winCondition'),
    lossCondition: parseLossCondition(sessionFields, 'lossCondition'),
    encounters: encountersSection.sections.map(parseEncounterSection)
  };
}

function parseEncounterSection(section: MarkdownSection): ParsedEncounter {
  const firstTable = requireFirstEncounterTable(section);
  const field = fieldReader(section, firstTable);
  const spawnKind = parseEnumField(field, 'spawnKind', ['empty', 'wave', 'static', 'boss']);
  const tables = requireEncounterTables(section, spawnKind);

  return {
    id: section.title,
    type: parseEncounterType(field),
    spawnPlan: parseSpawnPlan(field, tables),
    zoneBehavior: parseZoneBehavior(field),
    transitionRules: parseTransitionRules(field)
  };
}

function requireFirstEncounterTable(section: MarkdownSection): MarkdownTable {
  const table = section.tables[0];
  if (table === undefined) {
    throw sectionError(section, 'expected field/value table');
  }
  assertFieldValueHeader(section, table);
  return table;
}

export function requireEncounterTables(
  section: MarkdownSection,
  spawnKind: SpawnKind
): EncounterTables {
  const fields = requireFirstEncounterTable(section);
  const spawns = section.tables[1] ?? null;

  if (section.tables.length > 2) {
    throw sectionError(section, 'expected at most two GFM tables');
  }

  if (spawnKind === 'wave' || spawnKind === 'static') {
    if (spawns === null) {
      throw sectionError(section, `spawnKind "${spawnKind}" requires seq/archetypeId table`);
    }
    assertSpawnTableHeader(section, spawns, spawnKind);
  } else if (spawns !== null) {
    throw sectionError(section, `spawnKind "${spawnKind}" forbids seq/archetypeId table`);
  }

  return { fields, spawns };
}

function parseSpawnPlan(field: FieldReader, tables: EncounterTables): ParsedSpawnPlan {
  const spawnKind = parseEnumField(field, 'spawnKind', ['empty', 'wave', 'static', 'boss']);
  switch (spawnKind) {
    case 'empty':
      return { kind: 'empty' };
    case 'wave':
      return {
        kind: 'wave',
        spawns: parseWaveSpawns(field.section, requireSpawnTable(tables, spawnKind)),
        spawnIntervalMs: field.readNumber('spawnIntervalMs'),
        maxAlive: field.readNumber('maxAlive'),
        edgeMargin: field.readNumber('edgeMargin')
      };
    case 'static':
      return {
        kind: 'static',
        spawns: parseStaticSpawns(field.section, requireSpawnTable(tables, spawnKind))
      };
    case 'boss':
      return {
        kind: 'boss',
        bossArchetype: bossRef(field.read('bossArchetypeId')),
        position: parseBossSpawnPosition(field),
        bossEdgeMargin: field.readNumber('bossEdgeMargin')
      };
    default:
      return assertNever(spawnKind);
  }
}

function parseWaveSpawns(
  section: MarkdownSection,
  table: MarkdownTable
): ReadonlyArray<Readonly<{ archetype: ParsedRef }>> {
  return sortedSpawnRows(section, table).map((row) => ({
    archetype: enemyRef(requireColumn(section, table, row, 'archetypeId'))
  }));
}

function parseStaticSpawns(
  section: MarkdownSection,
  table: MarkdownTable
): ReadonlyArray<Readonly<{ archetype: ParsedRef; position: Readonly<{ x: number; y: number }> }>> {
  return sortedSpawnRows(section, table).map((row) => ({
    archetype: enemyRef(requireColumn(section, table, row, 'archetypeId')),
    position: {
      x: requireNumber(section, table, row, 'x'),
      y: requireNumber(section, table, row, 'y')
    }
  }));
}

function sortedSpawnRows(
  section: MarkdownSection,
  table: MarkdownTable
): ReadonlyArray<MarkdownTableRow> {
  const seen = new Set<number>();
  return table.rows
    .map((row) => ({ row, seq: readSeq(section, table, row, seen) }))
    .sort((left, right) => left.seq - right.seq)
    .map((entry) => entry.row);
}

function readSeq(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  seen: Set<number>
): number {
  const seq = requireNumber(section, table, row, 'seq');
  if (!Number.isInteger(seq) || seq <= 0) {
    throw cellError(section, row.position, getRowId(row), 'seq', 'expected positive integer');
  }
  if (seen.has(seq)) {
    throw cellError(section, row.position, getRowId(row), 'seq', `duplicate seq "${seq}"`);
  }
  seen.add(seq);
  return seq;
}

function parseZoneBehavior(field: FieldReader): ZoneBehavior {
  const zoneKind = parseEnumField(field, 'zoneKind', ['disabled', 'shrinkLinear', 'expandLinear']);
  switch (zoneKind) {
    case 'disabled':
      return { kind: 'disabled' };
    case 'shrinkLinear':
    case 'expandLinear':
      return {
        kind: zoneKind,
        fromMargin: field.readNumber('zoneFromMargin'),
        toMargin: field.readNumber('zoneToMargin'),
        durationMs: field.readNumber('zoneDurationMs')
      };
    default:
      return assertNever(zoneKind);
  }
}

function parseTransitionRules(field: FieldReader): ParsedTransitionRules {
  const transitionKind = parseEnumField(field, 'transitionKind', [
    'never',
    'allEnemiesCleared',
    'timer'
  ]);
  const next = parseTransitionNext(field);
  switch (transitionKind) {
    case 'never':
    case 'allEnemiesCleared':
      return { kind: transitionKind, next };
    case 'timer':
      return {
        kind: 'timer',
        durationMs: field.readNumber('transitionDurationMs'),
        next
      };
    default:
      return assertNever(transitionKind);
  }
}

function parseTransitionNext(field: FieldReader): TransitionNext {
  const raw = field.read('next');
  if (raw !== 'sequential') {
    throw fieldError(field, 'next', 'expected "sequential"');
  }
  return 'sequential';
}

function parseEncounterType(field: FieldReader): EncounterType {
  return parseEnumField(field, 'type', ['wave', 'break', 'boss', 'survivalTimer', 'sandbox']);
}

function parseBossSpawnPosition(field: FieldReader): 'top-center' {
  const raw = field.read('bossSpawnPosition');
  if (raw !== 'top-center') {
    throw fieldError(field, 'bossSpawnPosition', 'expected "top-center"');
  }
  return raw;
}

function parseWinCondition(field: FieldReader, fieldName: string): ParsedWinCondition {
  const kind = parseEnumField(field, fieldName, [
    'none',
    'allEncountersComplete',
    'bossDefeated',
    'scenarioCondition'
  ]);
  return { kind };
}

function parseLossCondition(field: FieldReader, fieldName: string): ParsedLossCondition {
  const kind = parseEnumField(field, fieldName, [
    'none',
    'playerDeath',
    'timerOrScenarioFail',
    'forced'
  ]);
  return { kind };
}

function parseBooleanField(field: FieldReader, fieldName: string): boolean {
  const raw = field.read(fieldName);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw fieldError(field, fieldName, 'expected true or false');
}

function parseLoadoutWeapon(raw: string): ParsedRef | null {
  if (raw === 'none') {
    return null;
  }
  return weaponRef(raw);
}

function parseEnumField<const T extends string>(
  field: FieldReader,
  fieldName: string,
  allowed: ReadonlyArray<T>
): T {
  const raw = field.read(fieldName);
  if (allowed.includes(raw as T)) {
    return raw as T;
  }
  throw fieldError(field, fieldName, `expected one of: ${allowed.join(', ')}`);
}

function fieldReader(section: MarkdownSection, table: MarkdownTable): FieldReader {
  assertFieldValueHeader(section, table);
  return {
    section,
    table,
    read(fieldName: string): string {
      return requireField(section, table, fieldName);
    },
    readNumber(fieldName: string): number {
      const raw = requireField(section, table, fieldName);
      const row = findFieldRow(table, fieldName);
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        throw cellError(section, row?.position ?? section.position, fieldName, 'value', 'expected number');
      }
      return value;
    }
  };
}

function findFieldRow(table: MarkdownTable, fieldName: string): MarkdownTableRow | null {
  return table.rows.find((row) => row.cells[0]?.value === fieldName) ?? null;
}

function fieldError(field: FieldReader, fieldName: string, expected: string): ContentBuildError {
  const row = findFieldRow(field.table, fieldName);
  return cellError(field.section, row?.position ?? field.section.position, fieldName, 'value', expected);
}

function requireSpawnTable(tables: EncounterTables, spawnKind: 'wave' | 'static'): MarkdownTable {
  const table = tables.spawns;
  if (table === null) {
    throw new ContentBuildError(`sessions parser invariant failed for spawnKind "${spawnKind}"`);
  }
  return table;
}

function assertFieldValueHeader(section: MarkdownSection, table: MarkdownTable): void {
  if (table.header[0]?.value !== 'field' || table.header[1]?.value !== 'value') {
    throw cellError(section, table.position, '<header>', 'field/value', 'expected field/value table');
  }
}

function assertSpawnTableHeader(
  section: MarkdownSection,
  table: MarkdownTable,
  spawnKind: SpawnKind
): void {
  const expected = spawnKind === 'static' ? ['seq', 'archetypeId', 'x', 'y'] : ['seq', 'archetypeId'];
  for (const [index, columnName] of expected.entries()) {
    if (table.header[index]?.value !== columnName) {
      throw cellError(section, table.position, '<header>', columnName, `expected ${expected.join(' | ')} table`);
    }
  }
  if (table.header.length !== expected.length) {
    throw cellError(section, table.position, '<header>', expected.at(-1) ?? '<unknown>', `expected ${expected.join(' | ')} table`);
  }
}

function requireColumn(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): string {
  const columnIndex = table.header.findIndex((cell) => cell.value === columnName);
  if (columnIndex < 0) {
    throw cellError(section, row.position, getRowId(row), columnName, `expected column "${columnName}"`);
  }
  const value = row.cells[columnIndex]?.value;
  if (value === undefined || value.length === 0) {
    throw cellError(section, row.position, getRowId(row), columnName, 'expected non-empty value');
  }
  return value;
}

function arenaRef(id: string): ParsedRef {
  return { id, constName: `${toConstName(id)}_ARENA` };
}

function playerRef(id: string): ParsedRef {
  if (id === 'hero-sandbox') return { id, constName: 'SANDBOX_PLAYER' };
  if (id === 'hero-training') return { id, constName: 'TRAINING_PLAYER' };
  return { id, constName: `${toConstName(id)}_PLAYER` };
}

function weaponRef(id: string): ParsedRef {
  return { id, constName: toConstName(id) };
}

function enemyRef(id: string): ParsedRef {
  return { id, constName: toConstName(id) };
}

function bossRef(id: string): ParsedRef {
  return { id, constName: toConstName(id) };
}

function presetIdFromSourcePath(sourcePath: string): string {
  return basename(sourcePath, extname(sourcePath));
}

function assertNever(value: never): never {
  throw new Error(`unhandled sessions parse value: ${String(value)}`);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
