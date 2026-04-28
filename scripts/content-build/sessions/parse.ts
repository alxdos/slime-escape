import { readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

import type {
  EncounterType,
  Loadout,
  LossCondition,
  SessionRules,
  TransitionNext,
  WinCondition,
  ZoneBehavior
} from '../../../src/shared/session';
import { log } from '../../../src/shared/log';
import {
  type MarkdownCell,
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
  sectionError
} from '../util/markdown';
import { getBuildSampleEntry } from '../util/sampleRegistry';
import { type InlineImage, requireInlineImageCell } from '../util/inlineMedia';
import {
  type ResolvedContentRef,
  requireArenaRef,
  requireBossRef,
  requireDropRef,
  requireEnemyRef,
  requirePlayerRef,
  requireWeaponRef
} from './crossAreaRefs';

export type ParsedRef = ResolvedContentRef;

export type ParsedWinCondition = WinCondition;
export type ParsedLossCondition = LossCondition;

export type ParsedSpawnPlan =
  | Readonly<{ kind: 'empty' }>
  | Readonly<{
      kind: 'wave';
      spawns: ReadonlyArray<ParsedWaveSpawn>;
      spawnIntervalMs: number;
      maxAlive: number;
      edgeMargin: number;
    }>
  | Readonly<{
      kind: 'static';
      spawns: ReadonlyArray<ParsedStaticSpawn>;
    }>
  | Readonly<{
      kind: 'boss';
      bossArchetype: ParsedRef;
      position: 'top-center';
      bossEdgeMargin: number;
    }>;

export type ParsedOverrideDropTableEntry = Readonly<{
  archetype: ParsedRef;
  chance: number;
}>;

export type ParsedRetaliationPolicy = Readonly<{
  enabled: boolean;
  durationMs: number;
}>;

export type ParsedSpawnOverride = Readonly<{
  guaranteedDrops?: ReadonlyArray<ParsedRef>;
  dropTable?: ReadonlyArray<ParsedOverrideDropTableEntry>;
  retaliation?: ParsedRetaliationPolicy;
  loadout?: ParsedLoadout;
}>;

export type ParsedWaveSpawn = Readonly<{
  archetype: ParsedRef;
  override?: ParsedSpawnOverride;
}>;

export type ParsedStaticSpawn = Readonly<{
  archetype: ParsedRef;
  position: Readonly<{ x: number; y: number }>;
  override?: ParsedSpawnOverride;
}>;

export type ParsedTransitionRules =
  | Readonly<{ kind: 'never'; next: TransitionNext }>
  | Readonly<{ kind: 'allEnemiesCleared'; next: TransitionNext }>
  | Readonly<{ kind: 'timer'; durationMs: number; next: TransitionNext }>;

export type ParsedEncounter = Readonly<{
  id: string;
  type: EncounterType;
  backgroundId: string | null;
  introDurationMs: number;
  name: string | null;
  text: string | null;
  spawnPlan: ParsedSpawnPlan;
  zoneBehavior: ZoneBehavior;
  transitionRules: ParsedTransitionRules;
}>;

export type ParsedSessionBackground = Readonly<{
  id: string;
  image: InlineImage;
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
  loadout: ParsedLoadout | null;
  backgrounds: ReadonlyArray<ParsedSessionBackground>;
  musicSampleId: string | null;
  rules: SessionRules;
  winCondition: ParsedWinCondition;
  lossCondition: ParsedLossCondition;
  encounters: ReadonlyArray<ParsedEncounter>;
}>;

export type ParsedLoadout = Readonly<{
  weapons: ReadonlyArray<ParsedRef>;
  selectedIndex: Loadout['selectedIndex'];
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
  overrides: MarkdownTable | null;
}>;

type SessionTables = Readonly<{
  fields: MarkdownTable;
  backgrounds: MarkdownTable;
}>;

type FieldReader = Readonly<{
  section: MarkdownSection;
  table: MarkdownTable;
  read(fieldName: string): string;
  readCell(fieldName: string): MarkdownCell;
  readOptionalCell(fieldName: string): MarkdownCell | null;
  readNumber(fieldName: string): number;
}>;

export async function parseSessionsArea(sourceDirectory: string): Promise<ParsedSessionsArea> {
  const sourcePaths = await listSessionMarkdownFiles(sourceDirectory);
  const presets = await Promise.all(sourcePaths.map(parseSessionFile));
  validateUniqueSessionPresetIds(presets);
  return {
    sourceDirectory,
    presets
  };
}

export function validateUniqueSessionPresetIds(
  presets: ReadonlyArray<Readonly<Pick<ParsedSessionPreset, 'presetId' | 'sourcePath'>>>
): void {
  const sourcePathByPresetId = new Map<string, string>();
  for (const preset of presets) {
    const previousSourcePath = sourcePathByPresetId.get(preset.presetId);
    if (previousSourcePath !== undefined) {
      throw new ContentBuildError(
        `${preset.sourcePath}: duplicate session presetId "${preset.presetId}" first defined in ${previousSourcePath}`
      );
    }
    sourcePathByPresetId.set(preset.presetId, preset.sourcePath);
  }
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
    .sort(compareSessionSourcePaths);

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
  const sessionTables = requireSessionTables(sessionSection);
  const sessionFields = fieldReader(sessionSection, sessionTables.fields);
  const backgrounds = parseSessionBackgrounds(sessionSection, sessionTables.backgrounds);
  const backgroundIds = new Set(backgrounds.map((background) => background.id));

  const preset = {
    sourcePath: document.filePath,
    presetId,
    displayName: sessionFields.read('displayName'),
    description: sessionFields.read('description'),
    visibleInMenu: parseBooleanField(sessionFields, 'visibleInMenu'),
    order: sessionFields.readNumber('order'),
    arena: parseArenaRef(sessionFields, 'arenaId'),
    player: parsePlayerRef(sessionFields, 'playerId'),
    loadout: parseLoadout(sessionFields),
    backgrounds,
    musicSampleId: parseMusicSampleId(sessionFields),
    rules: parseSessionRules(sessionFields),
    winCondition: parseWinCondition(sessionFields, 'winCondition'),
    lossCondition: parseLossCondition(sessionFields, 'lossCondition'),
    encounters: encountersSection.sections.map((section) =>
      parseEncounterSection(section, backgroundIds)
    )
  };
  validateSessionPreset(preset);
  return preset;
}

function validateSessionPreset(preset: ParsedSessionPreset): void {
  if (preset.winCondition.kind !== 'dungeon') return;
  if (preset.lossCondition.kind !== 'playerDeath') {
    throw new ContentBuildError(
      `${preset.sourcePath}: winCondition "dungeon" requires lossCondition "playerDeath"`
    );
  }
  if (!preset.encounters.some((encounter) => encounter.type === 'wave')) {
    throw new ContentBuildError(
      `${preset.sourcePath}: winCondition "dungeon" requires at least one wave encounter`
    );
  }
}

function parseEncounterSection(
  section: MarkdownSection,
  backgroundIds: ReadonlySet<string>
): ParsedEncounter {
  const firstTable = requireFirstEncounterTable(section);
  const field = fieldReader(section, firstTable);
  const type = parseEncounterType(field);
  const spawnKind = parseEnumField(field, 'spawnKind', ['empty', 'wave', 'static', 'boss']);
  const zoneKind = parseEnumField(field, 'zoneKind', ['disabled', 'shrinkLinear', 'expandLinear']);
  const transitionKind = parseEnumField(field, 'transitionKind', [
    'never',
    'allEnemiesCleared',
    'timer'
  ]);
  validatePortalEncounterKindPairings(field, type, spawnKind, zoneKind, transitionKind);
  const tables = requireEncounterTables(section, spawnKind);
  const transitionRules = parseTransitionRules(field);
  const presentation = parseEncounterPresentation(field, type, transitionRules);
  const spawnPlan = parseSpawnPlan(field, tables);
  const zoneBehavior = parseZoneBehavior(field);

  return {
    id: section.title,
    type,
    backgroundId: parseEncounterBackgroundId(field, type, backgroundIds),
    ...presentation,
    spawnPlan,
    zoneBehavior,
    transitionRules
  };
}

function requireSessionTables(section: MarkdownSection): SessionTables {
  const fields = section.tables[0];
  const backgrounds = section.tables[1];
  if (fields === undefined) {
    throw sectionError(section, 'expected field/value table');
  }
  assertFieldValueHeader(section, fields);
  if (backgrounds === undefined) {
    throw sectionError(section, 'expected backgroundId/image table');
  }
  assertBackgroundTableHeader(section, backgrounds);
  if (section.tables.length > 2) {
    throw sectionError(section, 'expected exactly two GFM tables');
  }
  return { fields, backgrounds };
}

function parseSessionBackgrounds(
  section: MarkdownSection,
  table: MarkdownTable
): ReadonlyArray<ParsedSessionBackground> {
  if (table.rows.length === 0) {
    throw cellError(section, table.position, '<body>', 'backgroundId', 'expected at least one background');
  }
  const seen = new Set<string>();
  return table.rows.map((row) => {
    const idCell = requireColumnCell(section, table, row, 'backgroundId');
    const imageCell = requireColumnCellAllowEmpty(section, table, row, 'image');
    const id = idCell.value;
    if (id === 'none') {
      throw cellError(section, idCell.position, getRowId(row), 'backgroundId', 'reserved id "none"');
    }
    if (seen.has(id)) {
      throw cellError(section, idCell.position, getRowId(row), 'backgroundId', `duplicate backgroundId "${id}"`);
    }
    seen.add(id);
    const image = requireInlineImageCell(imageCell, {
      sourcePath: section.filePath,
      context: `background "${id}" image`
    });
    if (image === null) {
      throw cellError(section, imageCell.position, getRowId(row), 'image', 'expected inline image ![…](../.../public/…)');
    }
    return { id, image };
  });
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
  const overrides = section.tables[2] ?? null;

  if (section.tables.length > 3) {
    throw sectionError(section, 'expected at most three GFM tables');
  }

  if (spawnKind === 'wave' || spawnKind === 'static') {
    if (spawns === null) {
      throw sectionError(section, `spawnKind "${spawnKind}" requires seq/archetypeId table`);
    }
    assertSpawnTableHeader(section, spawns, spawnKind);
    if (overrides !== null) {
      assertSpawnOverrideTableHeader(section, overrides);
    }
  } else if (spawns !== null) {
    if (looksLikeSpawnOverrideTable(spawns)) {
      throw sectionError(section, `spawnKind "${spawnKind}" forbids spawn override table`);
    }
    throw sectionError(section, `spawnKind "${spawnKind}" forbids seq/archetypeId table`);
  }

  return { fields, spawns, overrides };
}

function parseSpawnPlan(field: FieldReader, tables: EncounterTables): ParsedSpawnPlan {
  const spawnKind = parseEnumField(field, 'spawnKind', ['empty', 'wave', 'static', 'boss']);
  switch (spawnKind) {
    case 'empty':
      return { kind: 'empty' };
    case 'wave':
      return {
        kind: 'wave',
        spawns: parseWaveSpawns(
          field.section,
          requireSpawnTable(tables, spawnKind),
          tables.overrides
        ),
        spawnIntervalMs: field.readNumber('spawnIntervalMs'),
        maxAlive: field.readNumber('maxAlive'),
        edgeMargin: field.readNumber('edgeMargin')
      };
    case 'static':
      return {
        kind: 'static',
        spawns: parseStaticSpawns(
          field.section,
          requireSpawnTable(tables, spawnKind),
          tables.overrides
        )
      };
    case 'boss':
      return {
        kind: 'boss',
        bossArchetype: parseBossRef(field, 'bossArchetypeId'),
        position: parseBossSpawnPosition(field),
        bossEdgeMargin: field.readNumber('bossEdgeMargin')
      };
    default:
      return assertNever(spawnKind);
  }
}

function parseWaveSpawns(
  section: MarkdownSection,
  table: MarkdownTable,
  overrideTable: MarkdownTable | null
): ReadonlyArray<ParsedWaveSpawn> {
  const entries = sortedSpawnEntries(section, table);
  const overrides = parseSpawnOverrides(section, overrideTable, seqSet(entries));
  return entries.map(({ row, seq }) =>
    withOptionalOverride(
      {
        archetype: parseEnemyRef(section, table, row, 'archetypeId')
      },
      overrides.get(seq)
    )
  );
}

function parseStaticSpawns(
  section: MarkdownSection,
  table: MarkdownTable,
  overrideTable: MarkdownTable | null
): ReadonlyArray<ParsedStaticSpawn> {
  const entries = sortedSpawnEntries(section, table);
  const overrides = parseSpawnOverrides(section, overrideTable, seqSet(entries));
  return entries.map(({ row, seq }) =>
    withOptionalOverride(
      {
        archetype: parseEnemyRef(section, table, row, 'archetypeId'),
        position: {
          x: requireNumber(section, table, row, 'x'),
          y: requireNumber(section, table, row, 'y')
        }
      },
      overrides.get(seq)
    )
  );
}

type SpawnRowEntry = Readonly<{
  row: MarkdownTableRow;
  seq: number;
}>;

function sortedSpawnEntries(
  section: MarkdownSection,
  table: MarkdownTable
): ReadonlyArray<SpawnRowEntry> {
  const seen = new Set<number>();
  return table.rows
    .map((row) => ({ row, seq: readSeq(section, table, row, seen) }))
    .sort((left, right) => left.seq - right.seq)
}

function seqSet(entries: ReadonlyArray<SpawnRowEntry>): ReadonlySet<number> {
  return new Set(entries.map((entry) => entry.seq));
}

function withOptionalOverride<T extends object>(
  spawn: T,
  override: ParsedSpawnOverride | undefined
): T | (T & Readonly<{ override: ParsedSpawnOverride }>) {
  if (override === undefined) return spawn;
  return { ...spawn, override };
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

const SPAWN_OVERRIDE_HEADER = [
  'seq',
  'guaranteedDrops',
  'dropTable',
  'retaliationEnabled',
  'retaliationDurationMs',
  'loadoutWeaponIds',
  'selectedWeaponIndex'
] as const;

function parseSpawnOverrides(
  section: MarkdownSection,
  table: MarkdownTable | null,
  validSeqs: ReadonlySet<number>
): ReadonlyMap<number, ParsedSpawnOverride> {
  if (table === null) return new Map();
  assertSpawnOverrideTableHeader(section, table);

  const seen = new Set<number>();
  const overrides = new Map<number, ParsedSpawnOverride>();
  for (const row of table.rows) {
    const seq = readSeq(section, table, row, seen);
    if (!validSeqs.has(seq)) {
      throw cellError(
        section,
        row.position,
        String(seq),
        'seq',
        `override references missing seq "${seq}"`
      );
    }
    const override = parseSpawnOverrideRow(section, table, row);
    if (!isSpawnOverrideEmpty(override)) {
      overrides.set(seq, override);
    }
  }
  return overrides;
}

function parseSpawnOverrideRow(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): ParsedSpawnOverride {
  return {
    ...parseGuaranteedDropsOverride(section, table, row),
    ...parseDropTableOverride(section, table, row),
    ...parseRetaliationOverride(section, table, row),
    ...parseLoadoutOverride(section, table, row)
  };
}

function parseGuaranteedDropsOverride(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): Pick<ParsedSpawnOverride, 'guaranteedDrops'> {
  const cell = requireColumnCell(section, table, row, 'guaranteedDrops');
  if (cell.value === 'none') return {};
  if (cell.value === 'empty') {
    throw cellError(
      section,
      cell.position,
      getRowId(row),
      'guaranteedDrops',
      'expected comma-separated drop ids or none'
    );
  }
  const drops = cell.value.split(',').map((rawDropId) => {
    const dropId = rawDropId.trim();
    if (dropId.length === 0) {
      throw cellError(
        section,
        cell.position,
        getRowId(row),
        'guaranteedDrops',
        'expected comma-separated drop ids or none'
      );
    }
    return requireDropRef(section, cell.position, 'guaranteedDrops', dropId);
  });
  return { guaranteedDrops: drops };
}

function parseDropTableOverride(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): Pick<ParsedSpawnOverride, 'dropTable'> {
  const cell = requireColumnCell(section, table, row, 'dropTable');
  if (cell.value === 'none') return {};
  if (cell.value === 'empty') return { dropTable: [] };

  let sum = 0;
  const dropTable = cell.value.split(',').map((rawEntry) => {
    const [rawDropId, rawChance, ...extra] = rawEntry.split(':');
    const dropId = rawDropId?.trim() ?? '';
    const chanceRaw = rawChance?.trim() ?? '';
    if (dropId.length === 0 || chanceRaw.length === 0 || extra.length > 0) {
      throw cellError(
        section,
        cell.position,
        getRowId(row),
        'dropTable',
        'expected empty, none, or comma-separated dropId:chance pairs'
      );
    }
    const chance = Number(chanceRaw);
    if (!Number.isFinite(chance)) {
      throw cellError(section, cell.position, getRowId(row), 'dropTable', 'expected numeric chance');
    }
    if (!(chance >= 0 && chance <= 1)) {
      log.warn('spawn override drop table entry chance out of [0, 1] per design/spawn-overrides.md', {
        filePath: section.filePath,
        encounterId: section.title,
        seq: getRowId(row),
        dropArchetypeId: dropId,
        chance
      });
    }
    sum += chance;
    return {
      archetype: requireDropRef(section, cell.position, 'dropTable', dropId),
      chance
    };
  });
  if (sum > 1 + 1e-9) {
    log.warn('spawn override drop table chances sum exceeds 1 per design/spawn-overrides.md', {
      filePath: section.filePath,
      encounterId: section.title,
      seq: getRowId(row),
      sum
    });
  }
  return { dropTable };
}

function parseRetaliationOverride(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): Pick<ParsedSpawnOverride, 'retaliation'> {
  const enabledCell = requireColumnCell(section, table, row, 'retaliationEnabled');
  const durationCell = requireColumnCell(section, table, row, 'retaliationDurationMs');
  const enabledIsNone = enabledCell.value === 'none';
  const durationIsNone = durationCell.value === 'none';
  if (enabledIsNone && durationIsNone) return {};
  if (enabledIsNone !== durationIsNone) {
    throw cellError(
      section,
      enabledIsNone ? durationCell.position : enabledCell.position,
      getRowId(row),
      enabledIsNone ? 'retaliationDurationMs' : 'retaliationEnabled',
      'retaliationEnabled and retaliationDurationMs must be set together'
    );
  }

  const enabled = parseOverrideBoolean(section, enabledCell, getRowId(row), 'retaliationEnabled');
  const durationMs = Number(durationCell.value);
  if (!Number.isInteger(durationMs) || durationMs < 0) {
    throw cellError(
      section,
      durationCell.position,
      getRowId(row),
      'retaliationDurationMs',
      'expected integer >= 0 or none'
    );
  }
  if (enabled && durationMs <= 0) {
    log.warn('enabled spawn override retaliation duration must be positive per design/spawn-overrides.md', {
      filePath: section.filePath,
      encounterId: section.title,
      seq: getRowId(row),
      durationMs
    });
  }
  return { retaliation: { enabled, durationMs } };
}

function parseLoadoutOverride(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): Pick<ParsedSpawnOverride, 'loadout'> {
  const weaponIdsCell = requireColumnCell(section, table, row, 'loadoutWeaponIds');
  const selectedIndexCell = requireColumnCell(section, table, row, 'selectedWeaponIndex');
  const weaponIdsIsNone = weaponIdsCell.value === 'none';
  const selectedIndexIsNone = selectedIndexCell.value === 'none';
  if (weaponIdsIsNone && selectedIndexIsNone) return {};
  if (weaponIdsIsNone !== selectedIndexIsNone) {
    throw cellError(
      section,
      weaponIdsIsNone ? selectedIndexCell.position : weaponIdsCell.position,
      getRowId(row),
      weaponIdsIsNone ? 'selectedWeaponIndex' : 'loadoutWeaponIds',
      'loadoutWeaponIds and selectedWeaponIndex must be set together'
    );
  }

  const loadout = parseLoadoutCells({
    section,
    weaponIdsCell,
    selectedIndexCell,
    rowId: getRowId(row),
    selectedIndexRowId: getRowId(row),
    weaponColumnName: 'loadoutWeaponIds',
    selectedIndexColumnName: 'selectedWeaponIndex',
    allowNoneSelectedIndex: false
  });
  if (loadout === null) return {};
  return { loadout };
}

function parseOverrideBoolean(
  section: MarkdownSection,
  cell: MarkdownCell,
  rowId: string,
  columnName: string
): boolean {
  if (cell.value === 'true') return true;
  if (cell.value === 'false') return false;
  throw cellError(section, cell.position, rowId, columnName, 'expected true, false, or none');
}

function isSpawnOverrideEmpty(override: ParsedSpawnOverride): boolean {
  return (
    override.guaranteedDrops === undefined &&
    override.dropTable === undefined &&
    override.retaliation === undefined &&
    override.loadout === undefined
  );
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

function parseEncounterPresentation(
  field: FieldReader,
  type: EncounterType,
  transitionRules: ParsedTransitionRules
): Pick<ParsedEncounter, 'introDurationMs' | 'name' | 'text'> {
  const introDurationMs = parseIntroDurationMs(field);
  const name = parseNullableTextField(field, 'name');
  const text = parseNullableTextField(field, 'text');

  validateEncounterPresentationFields(field, type, introDurationMs, name, text, transitionRules);

  return { introDurationMs, name, text };
}

function parseIntroDurationMs(field: FieldReader): number {
  const cell = field.readCell('introDurationMs');
  if (cell.value === 'none') return 0;
  const value = Number(cell.value);
  if (!Number.isInteger(value) || value < 0) {
    throw cellError(
      field.section,
      cell.position,
      'introDurationMs',
      'value',
      'expected integer >= 0 or none'
    );
  }
  return value;
}

function parseNullableTextField(field: FieldReader, fieldName: 'name' | 'text'): string | null {
  const cell = field.readCell(fieldName);
  if (cell.value === 'none') return null;
  if (cell.value.trim().length === 0) {
    throw cellError(
      field.section,
      cell.position,
      fieldName,
      'value',
      'expected non-empty string or none'
    );
  }
  return cell.value;
}

function validateEncounterPresentationFields(
  field: FieldReader,
  type: EncounterType,
  introDurationMs: number,
  name: string | null,
  text: string | null,
  transitionRules: ParsedTransitionRules
): void {
  if (transitionRules.kind === 'timer' && introDurationMs > transitionRules.durationMs) {
    throw fieldError(
      field,
      'introDurationMs',
      'expected <= transitionDurationMs for timer encounter'
    );
  }

  switch (type) {
    case 'wave':
      if (text !== null) {
        throw fieldError(field, 'text', 'expected none for encounter type "wave"');
      }
      return;
    case 'break':
      requireZeroIntro(field, type, introDurationMs);
      requireNoName(field, type, name);
      return;
    case 'boss':
    case 'survivalTimer':
    case 'sandbox':
    case 'portal':
      requireZeroIntro(field, type, introDurationMs);
      requireNoName(field, type, name);
      requireNoText(field, type, text);
      return;
    default:
      assertNever(type);
  }
}

function requireZeroIntro(field: FieldReader, type: EncounterType, introDurationMs: number): void {
  if (introDurationMs !== 0) {
    throw fieldError(field, 'introDurationMs', `expected none or 0 for encounter type "${type}"`);
  }
}

function requireNoName(field: FieldReader, type: EncounterType, name: string | null): void {
  if (name !== null) {
    throw fieldError(field, 'name', `expected none for encounter type "${type}"`);
  }
}

function requireNoText(field: FieldReader, type: EncounterType, text: string | null): void {
  if (text !== null) {
    throw fieldError(field, 'text', `expected none for encounter type "${type}"`);
  }
}

function parseEncounterType(field: FieldReader): EncounterType {
  return parseEnumField(field, 'type', [
    'wave',
    'break',
    'boss',
    'survivalTimer',
    'sandbox',
    'portal'
  ]);
}

function validatePortalEncounterKindPairings(
  field: FieldReader,
  type: EncounterType,
  spawnKind: SpawnKind,
  zoneKind: ZoneKind,
  transitionKind: TransitionKind
): void {
  if (type !== 'portal') return;
  if (spawnKind !== 'empty') {
    throw fieldError(field, 'spawnKind', 'expected empty for encounter type "portal"');
  }
  if (zoneKind !== 'disabled') {
    throw fieldError(field, 'zoneKind', 'expected disabled for encounter type "portal"');
  }
  if (transitionKind !== 'never') {
    throw fieldError(field, 'transitionKind', 'expected never for encounter type "portal"');
  }
}

function parseEncounterBackgroundId(
  field: FieldReader,
  type: EncounterType,
  backgroundIds: ReadonlySet<string>
): string | null {
  const cell = field.readOptionalCell('backgroundId');
  if (cell === null) {
    if (requiresBackgroundId(type)) {
      throw fieldError(field, 'backgroundId', 'expected field "backgroundId"');
    }
    return null;
  }

  if (cell.value === 'none') {
    if (requiresBackgroundId(type)) {
      throw cellError(
        field.section,
        cell.position,
        'backgroundId',
        'value',
        `encounter type "${type}" requires a background id`
      );
    }
    return null;
  }

  if (!backgroundIds.has(cell.value)) {
    throw cellError(
      field.section,
      cell.position,
      'backgroundId',
      'value',
      `unknown backgroundId "${cell.value}"`
    );
  }

  return cell.value;
}

function requiresBackgroundId(type: EncounterType): boolean {
  return type === 'wave' || type === 'break' || type === 'boss';
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
    'dungeon',
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

function parseLoadout(field: FieldReader): ParsedLoadout | null {
  return parseLoadoutCells({
    section: field.section,
    weaponIdsCell: field.readCell('loadoutWeaponIds'),
    selectedIndexCell: field.readCell('selectedWeaponIndex'),
    rowId: 'loadoutWeaponIds',
    selectedIndexRowId: 'selectedWeaponIndex',
    weaponColumnName: 'value',
    selectedIndexColumnName: 'value',
    allowNoneSelectedIndex: true
  });
}

function parseMusicSampleId(field: FieldReader): string | null {
  const cell = field.readCell('musicSampleId');
  if (cell.value === 'none') return null;

  const entry = getBuildSampleEntry(cell.value);
  if (entry === null) {
    throw cellError(
      field.section,
      cell.position,
      'musicSampleId',
      'value',
      `unknown musicSampleId "${cell.value}"`
    );
  }
  if (entry.category !== 'music') {
    throw cellError(
      field.section,
      cell.position,
      'musicSampleId',
      'value',
      `musicSampleId "${cell.value}" must reference category "music"`
    );
  }
  return cell.value;
}

function parseLoadoutCells({
  section,
  weaponIdsCell,
  selectedIndexCell,
  rowId,
  selectedIndexRowId,
  weaponColumnName,
  selectedIndexColumnName,
  allowNoneSelectedIndex
}: Readonly<{
  section: MarkdownSection;
  weaponIdsCell: MarkdownCell;
  selectedIndexCell: MarkdownCell;
  rowId: string;
  selectedIndexRowId: string;
  weaponColumnName: string;
  selectedIndexColumnName: string;
  allowNoneSelectedIndex: boolean;
}>): ParsedLoadout | null {
  if (weaponIdsCell.value === 'none') {
    if (selectedIndexCell.value !== 'none') {
      throw cellError(
        section,
        selectedIndexCell.position,
        selectedIndexRowId,
        selectedIndexColumnName,
        'expected none when loadoutWeaponIds is none'
      );
    }
    return null;
  }
  const weapons = weaponIdsCell.value.split(',').map((rawWeaponId) => {
    const weaponId = rawWeaponId.trim();
    if (weaponId.length === 0) {
      throw cellError(
        section,
        weaponIdsCell.position,
        rowId,
        weaponColumnName,
        'expected comma-separated weapon ids'
      );
    }
    return requireWeaponRef(section, weaponIdsCell.position, 'loadoutWeaponIds', weaponId);
  });
  if (weapons.length === 0) {
    throw cellError(section, weaponIdsCell.position, rowId, weaponColumnName, 'expected weapon ids or none');
  }

  const selectedIndex = parseSelectedWeaponIndex({
    section,
    cell: selectedIndexCell,
    rowId: selectedIndexRowId,
    columnName: selectedIndexColumnName,
    weaponCount: weapons.length,
    allowNoneAsNull: allowNoneSelectedIndex
  });
  return { weapons, selectedIndex };
}

function parseSelectedWeaponIndex({
  section,
  cell,
  rowId,
  columnName,
  weaponCount,
  allowNoneAsNull
}: Readonly<{
  section: MarkdownSection;
  cell: MarkdownCell;
  rowId: string;
  columnName: string;
  weaponCount: number;
  allowNoneAsNull: boolean;
}>): number | null {
  if (allowNoneAsNull ? cell.value === 'none' : cell.value === 'null') return null;
  const value = Number(cell.value);
  if (!Number.isInteger(value) || value < 0 || value >= weaponCount) {
    const nullLabel = allowNoneAsNull ? 'none' : 'null';
    throw cellError(
      section,
      cell.position,
      rowId,
      columnName,
      `expected 0..${weaponCount - 1} or ${nullLabel}`
    );
  }
  return value;
}

function parseSessionRules(field: FieldReader): SessionRules {
  const aimAssistEnabled = parseBooleanField(field, 'aimAssistEnabled');
  const maxAngleRadians = field.readNumber('aimAssistMaxAngleRadians');
  const maxDistance = field.readNumber('aimAssistMaxDistance');
  const strength = field.readNumber('aimAssistStrength');
  if (aimAssistEnabled) {
    if (maxAngleRadians <= 0) {
      throw fieldError(field, 'aimAssistMaxAngleRadians', 'expected > 0 when aimAssistEnabled is true');
    }
    if (maxDistance <= 0) {
      throw fieldError(field, 'aimAssistMaxDistance', 'expected > 0 when aimAssistEnabled is true');
    }
    if (!(strength > 0 && strength <= 1)) {
      throw fieldError(field, 'aimAssistStrength', 'expected > 0 and <= 1 when aimAssistEnabled is true');
    }
  }
  return {
    damage: {
      slimeFriendlyFire: parseBooleanField(field, 'slimeFriendlyFire')
    },
    aimAssist: {
      enabled: aimAssistEnabled,
      maxAngleRadians,
      maxDistance,
      strength
    }
  };
}

function parseArenaRef(field: FieldReader, fieldName: string): ParsedRef {
  const cell = field.readCell(fieldName);
  return requireArenaRef(field.section, cell.position, fieldName, cell.value);
}

function parsePlayerRef(field: FieldReader, fieldName: string): ParsedRef {
  const cell = field.readCell(fieldName);
  return requirePlayerRef(field.section, cell.position, fieldName, cell.value);
}

function parseBossRef(field: FieldReader, fieldName: string): ParsedRef {
  const cell = field.readCell(fieldName);
  return requireBossRef(field.section, cell.position, fieldName, cell.value);
}

function parseEnemyRef(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): ParsedRef {
  const cell = requireColumnCell(section, table, row, columnName);
  return requireEnemyRef(section, cell.position, columnName, cell.value);
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
      return readFieldCell(section, table, fieldName).value;
    },
    readCell(fieldName: string): MarkdownCell {
      return readFieldCell(section, table, fieldName);
    },
    readOptionalCell(fieldName: string): MarkdownCell | null {
      const row = findFieldRow(table, fieldName);
      if (row === null) {
        return null;
      }
      const cell = row.cells[1];
      if (cell === undefined || cell.value.length === 0) {
        throw cellError(
          section,
          cell?.position ?? row.position,
          fieldName,
          'value',
          'expected non-empty value'
        );
      }
      return cell;
    },
    readNumber(fieldName: string): number {
      const cell = readFieldCell(section, table, fieldName);
      const value = Number(cell.value);
      if (!Number.isFinite(value)) {
        throw cellError(section, cell.position, fieldName, 'value', 'expected number');
      }
      return value;
    }
  };
}

function readFieldCell(
  section: MarkdownSection,
  table: MarkdownTable,
  fieldName: string
): MarkdownCell {
  const row = findFieldRow(table, fieldName);
  if (row === null) {
    throw cellError(section, section.position, fieldName, 'value', `expected field "${fieldName}"`);
  }
  const cell = row.cells[1];
  if (cell === undefined || cell.value.length === 0) {
    throw cellError(
      section,
      cell?.position ?? row.position,
      fieldName,
      'value',
      'expected non-empty value'
    );
  }
  return cell;
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

function assertBackgroundTableHeader(section: MarkdownSection, table: MarkdownTable): void {
  const expected = ['backgroundId', 'image'];
  for (const [index, columnName] of expected.entries()) {
    if (table.header[index]?.value !== columnName) {
      throw cellError(section, table.position, '<header>', columnName, `expected ${expected.join(' | ')} table`);
    }
  }
  if (table.header.length !== expected.length) {
    throw cellError(section, table.position, '<header>', 'image', `expected ${expected.join(' | ')} table`);
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

function assertSpawnOverrideTableHeader(
  section: MarkdownSection,
  table: MarkdownTable
): void {
  for (const [index, columnName] of SPAWN_OVERRIDE_HEADER.entries()) {
    const actual = table.header[index]?.value;
    if (actual === columnName) continue;
    if (
      actual !== undefined &&
      index > 0 &&
      !(SPAWN_OVERRIDE_HEADER as ReadonlyArray<string>).includes(actual)
    ) {
      throw cellError(
        section,
        table.position,
        '<header>',
        actual,
        `unknown spawn override field "${actual}"`
      );
    }
    throw cellError(
      section,
      table.position,
      '<header>',
      columnName,
      `expected ${SPAWN_OVERRIDE_HEADER.join(' | ')} table`
    );
  }
  if (table.header.length !== SPAWN_OVERRIDE_HEADER.length) {
    const extra = table.header[SPAWN_OVERRIDE_HEADER.length]?.value;
    if (extra !== undefined) {
      throw cellError(
        section,
        table.position,
        '<header>',
        extra,
        `unknown spawn override field "${extra}"`
      );
    }
    throw cellError(
      section,
      table.position,
      '<header>',
      SPAWN_OVERRIDE_HEADER.at(-1) ?? '<unknown>',
      `expected ${SPAWN_OVERRIDE_HEADER.join(' | ')} table`
    );
  }
}

function looksLikeSpawnOverrideTable(table: MarkdownTable): boolean {
  return (
    table.header[0]?.value === 'seq' &&
    table.header.some((cell) =>
      (SPAWN_OVERRIDE_HEADER as ReadonlyArray<string>).includes(cell.value)
    ) &&
    table.header.some((cell) => cell.value !== 'seq' && cell.value !== 'archetypeId')
  );
}

function requireColumnCell(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): MarkdownCell {
  const columnIndex = table.header.findIndex((cell) => cell.value === columnName);
  if (columnIndex < 0) {
    throw cellError(section, row.position, getRowId(row), columnName, `expected column "${columnName}"`);
  }
  const cell = row.cells[columnIndex];
  if (cell === undefined || cell.value.length === 0) {
    throw cellError(
      section,
      cell?.position ?? row.position,
      getRowId(row),
      columnName,
      'expected non-empty value'
    );
  }
  return cell;
}

function requireColumnCellAllowEmpty(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): MarkdownCell {
  const columnIndex = table.header.findIndex((cell) => cell.value === columnName);
  if (columnIndex < 0) {
    throw cellError(section, row.position, getRowId(row), columnName, `expected column "${columnName}"`);
  }
  const cell = row.cells[columnIndex];
  if (cell === undefined) {
    throw cellError(section, row.position, getRowId(row), columnName, 'expected cell');
  }
  return cell;
}

function presetIdFromSourcePath(sourcePath: string): string {
  return basename(sourcePath, extname(sourcePath));
}

function compareSessionSourcePaths(left: string, right: string): number {
  const leftPresetId = presetIdFromSourcePath(left);
  const rightPresetId = presetIdFromSourcePath(right);
  if (leftPresetId < rightPresetId) return -1;
  if (leftPresetId > rightPresetId) return 1;
  return 0;
}

function assertNever(value: never): never {
  throw new Error(`unhandled sessions parse value: ${String(value)}`);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
