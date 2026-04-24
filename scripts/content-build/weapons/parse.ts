import { type MarkdownDocument, type MarkdownSection, type MarkdownTable } from '../parse';
import { requireNumber, requireRow, requireSection } from '../util/require';
import { requireInlineAudioLink } from '../util/inlineMedia';
import {
  assertKnownReferences,
  readMarkdownDocument,
  requireField,
  requireFieldHexColor,
  requireSingleTable,
  sectionError
} from '../util/markdown';
import { BUILD_SAMPLE_REGISTRY } from '../util/sampleRegistry';

export type ParsedWeaponAudio = Readonly<{
  fire: ReadonlyArray<string>;
}>;

export type ParsedWeapon = Readonly<{
  id: string;
  displayName: string;
  cooldownMs: number;
  projectileSpeed: number;
  projectileRadius: number;
  projectileTtlMs: number;
  damage: number;
  knockbackImpulse: number;
  color: number;
  audio: ParsedWeaponAudio;
}>;

export type ParsedWeaponsArea = Readonly<{
  weapons: ReadonlyArray<ParsedWeapon>;
}>;

type WeaponDefinition = Readonly<{
  id: string;
  displayName: string;
  color: number;
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
  const projectileSection = requireSection(balanceSection, 'Projectile');
  const damageSection = requireSection(balanceSection, 'Damage');
  const forceSection = requireSection(balanceSection, 'Force');
  assertNoForbiddenSoundGroup(balanceSection);

  const cooldownTable = requireSingleTable(cooldownSection);
  const projectileTable = requireSingleTable(projectileSection);
  const damageTable = requireSingleTable(damageSection);
  const forceTable = requireSingleTable(forceSection);

  assertKnownReferences(cooldownSection, cooldownTable, knownWeaponIds, 'weapon');
  assertKnownReferences(projectileSection, projectileTable, knownWeaponIds, 'weapon');
  assertKnownReferences(damageSection, damageTable, knownWeaponIds, 'weapon');
  assertKnownReferences(forceSection, forceTable, knownWeaponIds, 'weapon');

  return {
    weapons: definitions.map((definition) =>
      parseWeapon(definition, {
        cooldownSection,
        cooldownTable,
        projectileSection,
        projectileTable,
        damageSection,
        damageTable,
        forceSection,
        forceTable
      })
    )
  };
}

function parseWeaponDefinition(section: MarkdownSection): WeaponDefinition {
  const table = requireSingleTable(section);
  return {
    id: section.title,
    displayName: requireField(section, table, 'displayName'),
    color: requireFieldHexColor(section, table, 'color'),
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
    projectileSection: MarkdownSection;
    projectileTable: MarkdownTable;
    damageSection: MarkdownSection;
    damageTable: MarkdownTable;
    forceSection: MarkdownSection;
    forceTable: MarkdownTable;
  }>
): ParsedWeapon {
  const cooldownRow = requireRow(tables.cooldownSection, tables.cooldownTable, definition.id);
  const projectileRow = requireRow(tables.projectileSection, tables.projectileTable, definition.id);
  const damageRow = requireRow(tables.damageSection, tables.damageTable, definition.id);
  const forceRow = requireRow(tables.forceSection, tables.forceTable, definition.id);
  const knockbackImpulse = requireNumber(
    tables.forceSection,
    tables.forceTable,
    forceRow,
    'knockbackImpulse'
  );
  if (knockbackImpulse < 0) {
    throw sectionError(
      tables.forceSection,
      `weapon "${definition.id}" knockbackImpulse must be >= 0`
    );
  }

  return {
    ...definition,
    cooldownMs: requireNumber(tables.cooldownSection, tables.cooldownTable, cooldownRow, 'cooldownMs'),
    projectileSpeed: requireNumber(
      tables.projectileSection,
      tables.projectileTable,
      projectileRow,
      'projectileSpeed'
    ),
    projectileRadius: requireNumber(
      tables.projectileSection,
      tables.projectileTable,
      projectileRow,
      'projectileRadius'
    ),
    projectileTtlMs: requireNumber(
      tables.projectileSection,
      tables.projectileTable,
      projectileRow,
      'projectileTtlMs'
    ),
    damage: requireNumber(tables.damageSection, tables.damageTable, damageRow, 'damage'),
    knockbackImpulse,
    audio: definition.audio
  };
}

function assertNoForbiddenSoundGroup(balanceSection: MarkdownSection): void {
  const soundSection = balanceSection.sections.find((section) => section.title === 'Sound');
  if (soundSection !== undefined) {
    throw sectionError(soundSection, 'group "## Sound" is replaced by inline audio-link under weapon H2');
  }
}
