import type {
  ExplosionSpec,
  FirePattern,
  FragmentSpec,
  ProjectileArchetype,
  ProjectileMotion,
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
import { readSpriteAssetMetrics } from '../util/spriteMetrics';

export type ParsedWeaponAudio = Readonly<{
  fire: ReadonlyArray<string>;
}>;

export type ParsedWeapon = Readonly<{
  id: string;
  displayName: string;
  cooldownMs: number;
  firePattern: FirePattern;
  projectile: ProjectileArchetype;
  audio: ParsedWeaponAudio;
}>;

export type ParsedWeaponsArea = Readonly<{
  weapons: ReadonlyArray<ParsedWeapon>;
}>;

type WeaponDefinition = Readonly<{
  id: string;
  displayName: string;
  projectileSize: Readonly<{ width: number; height: number }>;
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
  const impactSection = requireSection(balanceSection, 'Projectile Impact');
  const explosionSection = requireSection(balanceSection, 'Explosion');
  const fragmentSection = requireSection(balanceSection, 'Explosion Fragments');
  const visualSection = requireSection(balanceSection, 'Projectile Visual');
  assertNoForbiddenSoundGroup(balanceSection);

  const cooldownTable = requireSingleTable(cooldownSection);
  const firePatternTable = requireSingleTable(firePatternSection);
  const motionTable = requireSingleTable(motionSection);
  const lifecycleTable = requireSingleTable(lifecycleSection);
  const impactTable = requireSingleTable(impactSection);
  const explosionTable = requireSingleTable(explosionSection);
  const fragmentTable = requireSingleTable(fragmentSection);
  const visualTable = requireSingleTable(visualSection);

  for (const [section, table] of [
    [cooldownSection, cooldownTable],
    [firePatternSection, firePatternTable],
    [motionSection, motionTable],
    [lifecycleSection, lifecycleTable],
    [impactSection, impactTable],
    [explosionSection, explosionTable],
    [fragmentSection, fragmentTable],
    [visualSection, visualTable]
  ] as const) {
    assertKnownReferences(section, table, knownWeaponIds, 'weapon');
  }

  return {
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
        impactSection,
        impactTable,
        explosionSection,
        explosionTable,
        fragmentSection,
        fragmentTable,
        visualSection,
        visualTable,
        knownWeaponIds
      })
    )
  };
}

function parseWeaponDefinition(section: MarkdownSection): WeaponDefinition {
  const table = requireSingleTable(section);
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
    audio: {
      fire: [requireInlineAudioLink(section, BUILD_SAMPLE_REGISTRY).sampleId]
    }
  };
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
    impactSection: MarkdownSection;
    impactTable: MarkdownTable;
    explosionSection: MarkdownSection;
    explosionTable: MarkdownTable;
    fragmentSection: MarkdownSection;
    fragmentTable: MarkdownTable;
    visualSection: MarkdownSection;
    visualTable: MarkdownTable;
    knownWeaponIds: ReadonlySet<string>;
  }>
): ParsedWeapon {
  const cooldownRow = requireRow(tables.cooldownSection, tables.cooldownTable, definition.id);
  const firePatternRow = requireRow(tables.firePatternSection, tables.firePatternTable, definition.id);
  const motionRow = requireRow(tables.motionSection, tables.motionTable, definition.id);
  const lifecycleRow = requireRow(tables.lifecycleSection, tables.lifecycleTable, definition.id);
  const impactRow = requireRow(tables.impactSection, tables.impactTable, definition.id);
  const explosionRow = requireRow(tables.explosionSection, tables.explosionTable, definition.id);
  const fragmentRow = requireRow(tables.fragmentSection, tables.fragmentTable, definition.id);
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
  const explosion = parseExplosion(tables.explosionSection, tables.explosionTable, explosionRow, fragment);
  if (explosion === null && fragment !== null) {
    throw cellError(
      tables.fragmentSection,
      fragmentRow.position,
      definition.id,
      'fragmentWeaponId',
      'fragment requires a non-none explosion'
    );
  }

  return {
    id: definition.id,
    displayName: definition.displayName,
    cooldownMs,
    firePattern: parseFirePattern(tables.firePatternSection, tables.firePatternTable, firePatternRow),
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
  fragments: FragmentSpec | null
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
    fragments
  };
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
