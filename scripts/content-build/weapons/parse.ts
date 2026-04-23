import { type MarkdownDocument, type MarkdownSection, type MarkdownTable } from '../parse';
import { requireNumber, requireRow, requireSampleIdList, requireSection } from '../util/require';
import {
  assertKnownReferences,
  readMarkdownDocument,
  requireField,
  requireFieldHexColor,
  requireSingleTable
} from '../util/markdown';

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
  const soundSection = requireSection(balanceSection, 'Sound');

  const cooldownTable = requireSingleTable(cooldownSection);
  const projectileTable = requireSingleTable(projectileSection);
  const damageTable = requireSingleTable(damageSection);
  const soundTable = requireSingleTable(soundSection);

  assertKnownReferences(cooldownSection, cooldownTable, knownWeaponIds, 'weapon');
  assertKnownReferences(projectileSection, projectileTable, knownWeaponIds, 'weapon');
  assertKnownReferences(damageSection, damageTable, knownWeaponIds, 'weapon');
  assertKnownReferences(soundSection, soundTable, knownWeaponIds, 'weapon');

  return {
    weapons: definitions.map((definition) =>
      parseWeapon(definition, {
        cooldownSection,
        cooldownTable,
        projectileSection,
        projectileTable,
        damageSection,
        damageTable,
        soundSection,
        soundTable
      })
    )
  };
}

function parseWeaponDefinition(section: MarkdownSection): WeaponDefinition {
  const table = requireSingleTable(section);
  return {
    id: section.title,
    displayName: requireField(section, table, 'displayName'),
    color: requireFieldHexColor(section, table, 'color')
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
    soundSection: MarkdownSection;
    soundTable: MarkdownTable;
  }>
): ParsedWeapon {
  const cooldownRow = requireRow(tables.cooldownSection, tables.cooldownTable, definition.id);
  const projectileRow = requireRow(tables.projectileSection, tables.projectileTable, definition.id);
  const damageRow = requireRow(tables.damageSection, tables.damageTable, definition.id);
  const soundRow = requireRow(tables.soundSection, tables.soundTable, definition.id);

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
    audio: {
      fire: requireSampleIdList(tables.soundSection, tables.soundTable, soundRow, 'fire')
    }
  };
}
