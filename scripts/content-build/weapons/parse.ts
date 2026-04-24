import type {
  ActorEffectApplication,
  DetonationTrigger,
  ExplosionSpec,
  FieldEffectSpec,
  FirePattern,
  FragmentSpec,
  ProjectileArchetype,
  ProjectileMotion,
  StatusEffectSpec,
  ProjectileVisualSpec
} from '../../../src/shared/content/weapons';

import { type MarkdownDocument, type MarkdownSection, type MarkdownTable, type MarkdownTableRow } from '../parse';
import { requireCell, requireNumber, requireRow, requireSection } from '../util/require';
import { requireInlineAudioLink, requireInlineImage } from '../util/inlineMedia';
import {
  assertKnownReferences,
  cellError,
  getRowId,
  readMarkdownDocument,
  requireField,
  requireSingleTable,
  sectionError
} from '../util/markdown';
import { BUILD_SAMPLE_REGISTRY } from '../util/sampleRegistry';
import { readSpriteAssetMetrics, type SpriteAssetMetrics } from '../util/spriteMetrics';

export type ParsedWeaponAudio = Readonly<{
  fire: ReadonlyArray<string>;
}>;

export type ParsedProjectileSpriteVisual = SpriteAssetMetrics &
  Readonly<{
    image: string;
  }>;

export type ParsedWeapon = Readonly<{
  id: string;
  displayName: string;
  cooldownMs: number;
  firePattern: FirePattern;
  projectile: ProjectileArchetype;
  projectileSpriteVisual: ParsedProjectileSpriteVisual;
  audio: ParsedWeaponAudio;
}>;

export type ParsedWeaponsArea = Readonly<{
  sourcePath: string;
  weapons: ReadonlyArray<ParsedWeapon>;
}>;

type WeaponDefinition = Readonly<{
  id: string;
  displayName: string;
  projectileSize: Readonly<{ width: number; height: number }>;
  projectileSpriteVisual: ParsedProjectileSpriteVisual;
  audio: ParsedWeaponAudio;
}>;

export async function parseWeaponsArea(sourcePath: string): Promise<ParsedWeaponsArea> {
  const document = await readMarkdownDocument(sourcePath);
  return parseWeaponsDocument(document);
}

function parseWeaponsDocument(document: MarkdownDocument): ParsedWeaponsArea {
  const weaponsSection = requireSection(document, 'Weapons');
  const balanceSection = requireSection(document, 'Balance');

  const definitions = weaponsSection.sections.map(parseWeaponDefinition);
  const knownWeaponIds = new Set(definitions.map((weapon) => weapon.id));

  const cooldownSection = requireSection(balanceSection, 'Cooldown');
  const firePatternSection = requireSection(balanceSection, 'Fire Pattern');
  const motionSection = requireSection(balanceSection, 'Projectile Motion');
  const lifecycleSection = requireSection(balanceSection, 'Projectile Lifecycle');
  const detonationTriggerSection = requireSection(balanceSection, 'Detonation Trigger');
  const impactSection = requireSection(balanceSection, 'Projectile Impact');
  const explosionSection = requireSection(balanceSection, 'Explosion');
  const fragmentSection = requireSection(balanceSection, 'Explosion Fragments');
  const explosionFieldSection = requireSection(balanceSection, 'Explosion Field Effect');
  const explosionStatusSection = requireSection(balanceSection, 'Explosion Status');
  const visualSection = requireSection(balanceSection, 'Projectile Visual');
  assertNoForbiddenSoundGroup(balanceSection);

  const cooldownTable = requireSingleTable(cooldownSection);
  const firePatternTable = requireSingleTable(firePatternSection);
  const motionTable = requireSingleTable(motionSection);
  const lifecycleTable = requireSingleTable(lifecycleSection);
  const detonationTriggerTable = requireSingleTable(detonationTriggerSection);
  const impactTable = requireSingleTable(impactSection);
  const explosionTable = requireSingleTable(explosionSection);
  const fragmentTable = requireSingleTable(fragmentSection);
  const explosionFieldTable = requireSingleTable(explosionFieldSection);
  const explosionStatusTable = requireSingleTable(explosionStatusSection);
  const visualTable = requireSingleTable(visualSection);

  for (const [section, table] of [
    [cooldownSection, cooldownTable],
    [firePatternSection, firePatternTable],
    [motionSection, motionTable],
    [lifecycleSection, lifecycleTable],
    [detonationTriggerSection, detonationTriggerTable],
    [impactSection, impactTable],
    [explosionSection, explosionTable],
    [fragmentSection, fragmentTable],
    [explosionFieldSection, explosionFieldTable],
    [explosionStatusSection, explosionStatusTable],
    [visualSection, visualTable]
  ] as const) {
    assertNoForbiddenSpriteColumns(section, table);
    assertKnownReferences(section, table, knownWeaponIds, 'weapon');
  }

  return {
    sourcePath: document.filePath,
    weapons: definitions.map((definition) =>
      parseWeapon(definition, {
        cooldownSection,
        cooldownTable,
        firePatternSection,
        firePatternTable,
        motionSection,
        motionTable,
        lifecycleSection,
        lifecycleTable,
        detonationTriggerSection,
        detonationTriggerTable,
        impactSection,
        impactTable,
        explosionSection,
        explosionTable,
        fragmentSection,
        fragmentTable,
        explosionFieldSection,
        explosionFieldTable,
        explosionStatusSection,
        explosionStatusTable,
        visualSection,
        visualTable,
        knownWeaponIds
      })
    )
  };
}

function parseWeaponDefinition(section: MarkdownSection): WeaponDefinition {
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
    projectileSize: metrics.worldSize,
    projectileSpriteVisual: {
      image: image.url,
      sourceSizePx: metrics.sourceSizePx,
      worldSize: metrics.worldSize
    },
    audio: {
      fire: [requireInlineAudioLink(section, BUILD_SAMPLE_REGISTRY).sampleId]
    }
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
      field === 'size' ||
      field === 'projectileSize'
    ) {
      throw cellError(
        section,
        row.position,
        field,
        'field',
        'sprite fields are derived from the inline image under weapon H2'
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
      column === 'size' ||
      column === 'projectileSize'
    ) {
      throw cellError(
        section,
        headerCell.position,
        '<header>',
        column,
        'sprite fields are derived from the inline image under weapon H2'
      );
    }
  }
}

function parseWeapon(
  definition: WeaponDefinition,
  tables: Readonly<{
    cooldownSection: MarkdownSection;
    cooldownTable: MarkdownTable;
    firePatternSection: MarkdownSection;
    firePatternTable: MarkdownTable;
    motionSection: MarkdownSection;
    motionTable: MarkdownTable;
    lifecycleSection: MarkdownSection;
    lifecycleTable: MarkdownTable;
    detonationTriggerSection: MarkdownSection;
    detonationTriggerTable: MarkdownTable;
    impactSection: MarkdownSection;
    impactTable: MarkdownTable;
    explosionSection: MarkdownSection;
    explosionTable: MarkdownTable;
    fragmentSection: MarkdownSection;
    fragmentTable: MarkdownTable;
    explosionFieldSection: MarkdownSection;
    explosionFieldTable: MarkdownTable;
    explosionStatusSection: MarkdownSection;
    explosionStatusTable: MarkdownTable;
    visualSection: MarkdownSection;
    visualTable: MarkdownTable;
    knownWeaponIds: ReadonlySet<string>;
  }>
): ParsedWeapon {
  const cooldownRow = requireRow(tables.cooldownSection, tables.cooldownTable, definition.id);
  const firePatternRow = requireRow(tables.firePatternSection, tables.firePatternTable, definition.id);
  const motionRow = requireRow(tables.motionSection, tables.motionTable, definition.id);
  const lifecycleRow = requireRow(tables.lifecycleSection, tables.lifecycleTable, definition.id);
  const detonationTriggerRow = requireRow(tables.detonationTriggerSection, tables.detonationTriggerTable, definition.id);
  const impactRow = requireRow(tables.impactSection, tables.impactTable, definition.id);
  const explosionRow = requireRow(tables.explosionSection, tables.explosionTable, definition.id);
  const fragmentRow = requireRow(tables.fragmentSection, tables.fragmentTable, definition.id);
  const explosionFieldRow = requireRow(tables.explosionFieldSection, tables.explosionFieldTable, definition.id);
  const explosionStatusRow = requireRow(tables.explosionStatusSection, tables.explosionStatusTable, definition.id);
  const visualRow = requireRow(tables.visualSection, tables.visualTable, definition.id);

  const cooldownMs = requireNumber(tables.cooldownSection, tables.cooldownTable, cooldownRow, 'cooldownMs');
  if (cooldownMs <= 0) {
    throw cellError(tables.cooldownSection, cooldownRow.position, definition.id, 'cooldownMs', 'expected > 0');
  }

  const fragment = parseFragment(
    tables.fragmentSection,
    tables.fragmentTable,
    fragmentRow,
    tables.knownWeaponIds
  );
  const fieldEffect = parseFieldEffect(tables.explosionFieldSection, tables.explosionFieldTable, explosionFieldRow);
  const explosionEffects = parseExplosionEffects(
    tables.explosionStatusSection,
    tables.explosionStatusTable,
    explosionStatusRow
  );
  const explosion = parseExplosion(
    tables.explosionSection,
    tables.explosionTable,
    explosionRow,
    fragment,
    fieldEffect,
    explosionEffects
  );
  if (explosion === null && fragment !== null) {
    throw cellError(
      tables.fragmentSection,
      fragmentRow.position,
      definition.id,
      'fragmentWeaponId',
      'fragment requires a non-none explosion'
    );
  }
  if (explosion === null && fieldEffect !== null) {
    throw cellError(
      tables.explosionFieldSection,
      explosionFieldRow.position,
      definition.id,
      'fieldArchetypeId',
      'field effect requires a non-none explosion'
    );
  }
  if (explosion === null && explosionEffects.length > 0) {
    throw cellError(
      tables.explosionStatusSection,
      explosionStatusRow.position,
      definition.id,
      'statusKind',
      'status application requires a non-none explosion'
    );
  }
  const detonationTrigger = parseDetonationTrigger(
    tables.detonationTriggerSection,
    tables.detonationTriggerTable,
    detonationTriggerRow
  );
  if (explosion === null && detonationTrigger !== null) {
    throw cellError(
      tables.detonationTriggerSection,
      detonationTriggerRow.position,
      definition.id,
      'kind',
      'detonation trigger requires a non-none explosion'
    );
  }

  return {
    id: definition.id,
    displayName: definition.displayName,
    cooldownMs,
    firePattern: parseFirePattern(tables.firePatternSection, tables.firePatternTable, firePatternRow),
    projectileSpriteVisual: definition.projectileSpriteVisual,
    projectile: {
      motion: parseProjectileMotion(tables.motionSection, tables.motionTable, motionRow),
      size: definition.projectileSize,
      hitRadius: parsePositiveNumber(tables.lifecycleSection, tables.lifecycleTable, lifecycleRow, 'hitRadius'),
      impactDamage: parseNonNegativeNumber(tables.impactSection, tables.impactTable, impactRow, 'impactDamage'),
      knockbackImpulse: parseNonNegativeNumber(tables.impactSection, tables.impactTable, impactRow, 'knockbackImpulse'),
      pierceCount: parseNonNegativeInteger(tables.impactSection, tables.impactTable, impactRow, 'pierceCount'),
      ttlMs: parsePositiveNumber(tables.lifecycleSection, tables.lifecycleTable, lifecycleRow, 'ttlMs'),
      groundOnImpact: parseBoolean(tables.lifecycleSection, tables.lifecycleTable, lifecycleRow, 'groundOnImpact'),
      groundedLifetimeMs: parseNullablePositiveNumber(
        tables.lifecycleSection,
        tables.lifecycleTable,
        lifecycleRow,
        'groundedLifetimeMs'
      ),
      detonationTrigger,
      explosion,
      visual: parseProjectileVisual(tables.visualSection, tables.visualTable, visualRow)
    },
    audio: definition.audio
  };
}

function parseFirePattern(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): FirePattern {
  const kind = requireCell(section, table, row, 'kind');
  switch (kind) {
    case 'single':
      return {
        kind,
        count: parsePositiveInteger(section, table, row, 'count'),
        spreadRadians: parseNonNegativeNumber(section, table, row, 'spreadRadians')
      };
    case 'multiDirection':
      return {
        kind,
        directions: parseNumberList(section, table, row, 'directionsRadians')
      };
    case 'place':
      return { kind };
    default:
      throw cellError(section, row.position, getRowId(row), 'kind', 'expected single, multiDirection or place');
  }
}

function parseProjectileMotion(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): ProjectileMotion {
  const kind = requireCell(section, table, row, 'kind');
  switch (kind) {
    case 'linear':
      return { kind, speed: parsePositiveNumber(section, table, row, 'speed') };
    case 'arc':
      return {
        kind,
        speed: parsePositiveNumber(section, table, row, 'speed'),
        range: parsePositiveNumber(section, table, row, 'range'),
        flightMs: parsePositiveNumber(section, table, row, 'flightMs')
      };
    case 'placed':
      return { kind };
    default:
      throw cellError(section, row.position, getRowId(row), 'kind', 'expected linear, arc or placed');
  }
}

function parseExplosion(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  fragments: FragmentSpec | null,
  fieldEffect: FieldEffectSpec | null,
  effects: ReadonlyArray<ActorEffectApplication>
): ExplosionSpec | null {
  const delayMs = parseNullablePositiveNumber(section, table, row, 'delayMs');
  if (delayMs === null) {
    return null;
  }
  return {
    delayMs,
    radius: parseNonNegativeNumber(section, table, row, 'radius'),
    damage: parseNonNegativeNumber(section, table, row, 'damage'),
    knockbackImpulse: parseNonNegativeNumber(section, table, row, 'knockbackImpulse'),
    fragments,
    fieldEffect,
    effects
  };
}

function parseDetonationTrigger(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): DetonationTrigger | null {
  const kind = requireCell(section, table, row, 'kind');
  switch (kind) {
    case 'none':
      return null;
    case 'timer':
      return { kind };
    case 'proximity':
    case 'timerOrProximity':
      return {
        kind,
        radius: parsePositiveNumber(section, table, row, 'radius'),
        armDelayMs: parseNonNegativeNumber(section, table, row, 'armDelayMs')
      };
    default:
      throw cellError(section, row.position, getRowId(row), 'kind', 'expected none, timer, proximity or timerOrProximity');
  }
}

function parseFieldEffect(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): FieldEffectSpec | null {
  const archetypeId = requireCell(section, table, row, 'fieldArchetypeId');
  if (archetypeId === 'none') return null;
  return {
    archetypeId,
    radius: parsePositiveNumber(section, table, row, 'radius'),
    durationMs: parsePositiveNumber(section, table, row, 'durationMs'),
    applyEveryMs: parsePositiveNumber(section, table, row, 'applyEveryMs'),
    effects: parseActorEffects(section, table, row)
  };
}

function parseActorEffects(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): ReadonlyArray<ActorEffectApplication> {
  const effects: ActorEffectApplication[] = [];
  const damage = parseNullablePositiveNumber(section, table, row, 'damage');
  if (damage !== null) {
    effects.push({ kind: 'damage', amount: damage });
  }
  const status = parseStatusEffect(section, table, row);
  if (status !== null) {
    effects.push({ kind: 'status', status });
  }
  if (effects.length === 0) {
    throw cellError(section, row.position, getRowId(row), 'damage', 'expected damage or status effect');
  }
  return effects;
}

function parseExplosionEffects(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): ReadonlyArray<ActorEffectApplication> {
  const status = parseStatusEffect(section, table, row);
  return status === null ? [] : [{ kind: 'status', status }];
}

function parseStatusEffect(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): StatusEffectSpec | null {
  const kind = requireCell(section, table, row, 'statusKind');
  switch (kind) {
    case 'none':
      return null;
    case 'burn':
    case 'poison':
      return {
        kind,
        damagePerTick: parsePositiveNumber(section, table, row, 'statusValue'),
        tickEveryMs: parsePositiveNumber(section, table, row, 'tickEveryMs'),
        durationMs: parsePositiveNumber(section, table, row, 'statusDurationMs')
      };
    case 'slow':
      return {
        kind,
        speedMultiplier: parsePositiveNumber(section, table, row, 'statusValue'),
        durationMs: parsePositiveNumber(section, table, row, 'statusDurationMs')
      };
    default:
      throw cellError(section, row.position, getRowId(row), 'statusKind', 'expected none, burn, slow or poison');
  }
}

function parseFragment(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  knownWeaponIds: ReadonlySet<string>
): FragmentSpec | null {
  const weaponArchetypeId = requireCell(section, table, row, 'fragmentWeaponId');
  if (weaponArchetypeId === 'none') {
    return null;
  }
  if (!knownWeaponIds.has(weaponArchetypeId)) {
    throw cellError(
      section,
      row.position,
      getRowId(row),
      'fragmentWeaponId',
      `unknown weapon id "${weaponArchetypeId}"`
    );
  }
  return {
    weaponArchetypeId,
    count: parsePositiveInteger(section, table, row, 'count'),
    spreadRadians: parseNonNegativeNumber(section, table, row, 'spreadRadians')
  };
}

function parseProjectileVisual(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow
): ProjectileVisualSpec {
  return {
    spinRadiansPerSec: parseNonNegativeNumber(section, table, row, 'spinRadiansPerSec'),
    rotateWhileFlying: parseBoolean(section, table, row, 'rotateWhileFlying'),
    pulseWhenGrounded: parseBoolean(section, table, row, 'pulseWhenGrounded'),
    explosionRadiusIndicator: parseBoolean(section, table, row, 'explosionRadiusIndicator')
  };
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

function parseNumberList(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): ReadonlyArray<number> {
  const raw = requireCell(section, table, row, columnName);
  if (raw === 'none') {
    throw cellError(section, row.position, getRowId(row), columnName, 'expected comma-separated numbers');
  }
  const values = raw.split(',').map((part) => Number(part.trim()));
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw cellError(section, row.position, getRowId(row), columnName, 'expected comma-separated numbers');
  }
  return values;
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

function parseNullablePositiveNumber(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): number | null {
  const raw = requireCell(section, table, row, columnName);
  if (raw === 'none') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw cellError(section, row.position, getRowId(row), columnName, 'expected > 0 or none');
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

function parseNonNegativeInteger(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): number {
  const value = parseNonNegativeNumber(section, table, row, columnName);
  if (!Number.isInteger(value)) {
    throw cellError(section, row.position, getRowId(row), columnName, 'expected integer');
  }
  return value;
}

function assertNoForbiddenSoundGroup(balanceSection: MarkdownSection): void {
  const soundSection = balanceSection.sections.find((section) => section.title === 'Sound');
  if (soundSection !== undefined) {
    throw sectionError(soundSection, 'group "## Sound" is replaced by inline audio-link under weapon H2');
  }
}
