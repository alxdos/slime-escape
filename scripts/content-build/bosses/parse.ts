import {
  type MarkdownDocument,
  type MarkdownSection,
  type MarkdownTable,
  type MarkdownTableRow
} from '../parse';
import { requireCell, requireNumber, requireRow, requireSection } from '../util/require';
import { requireInlineImage } from '../util/inlineMedia';
import {
  assertKnownReferences,
  cellError,
  findRowsById,
  getRowId,
  readMarkdownDocument,
  readOptionalSampleIdList,
  requireField,
  requireFieldHexColor,
  requireIdList,
  requireSingleTable,
  sectionError
} from '../util/markdown';

export type ParsedBossPhase = Readonly<{
  id: string;
  allowedAttackIds: ReadonlyArray<string>;
  exitWhenHpFractionAtOrBelow: number;
}>;

export type ParsedBossAttack = Readonly<{
  key: string;
  pattern: string;
  cooldownMs: number;
  damage: number;
}>;

export type ParsedBossAudio = Readonly<{
  fire: ReadonlyArray<string>;
  phaseChange: ReadonlyArray<string>;
}>;

export type ParsedBossVisual = Readonly<{
  image: string;
}>;

export type ParsedBoss = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  maxHp: number;
  maxSpeed: number;
  color: number;
  contactDamage: number;
  contactCooldownMs: number;
  knockbackBaseImpulse: number;
  knockbackVelocityScale: number;
  knockbackDurationMs: number;
  phases: ReadonlyArray<ParsedBossPhase>;
  attacks: ReadonlyArray<ParsedBossAttack>;
  audio: ParsedBossAudio;
  visual: ParsedBossVisual;
}>;

export type ParsedBossesArea = Readonly<{
  sourcePath: string;
  bosses: ReadonlyArray<ParsedBoss>;
}>;

type BossDefinition = Readonly<{
  id: string;
  displayName: string;
  color: number;
  visual: ParsedBossVisual;
}>;

export async function parseBossesArea(sourcePath: string): Promise<ParsedBossesArea> {
  const document = await readMarkdownDocument(sourcePath);
  return parseBossesDocument(document);
}

function parseBossesDocument(document: MarkdownDocument): ParsedBossesArea {
  const bossesSection = requireSection(document, 'Bosses');
  const balanceSection = requireSection(document, 'Balance');

  const definitions = bossesSection.sections.map(parseBossDefinition);
  const knownBossIds = new Set(definitions.map((boss) => boss.id));

  const bodySection = requireSection(balanceSection, 'Body');
  const movementSection = requireSection(balanceSection, 'Movement');
  const contactSection = requireSection(balanceSection, 'Contact damage');
  const knockbackSection = requireSection(balanceSection, 'Knockback');
  const phasesSection = requireSection(balanceSection, 'Phases');
  const attacksSection = requireSection(balanceSection, 'Attacks');
  const soundsSection = requireSection(balanceSection, 'Sounds');
  assertNoForbiddenVisualGroup(balanceSection);

  const bodyTable = requireSingleTable(bodySection);
  const movementTable = requireSingleTable(movementSection);
  const contactTable = requireSingleTable(contactSection);
  const knockbackTable = requireSingleTable(knockbackSection);
  const phasesTable = requireSingleTable(phasesSection);
  const attacksTable = requireSingleTable(attacksSection);
  const soundsTable = requireSingleTable(soundsSection);

  assertKnownReferences(bodySection, bodyTable, knownBossIds, 'boss');
  assertKnownReferences(movementSection, movementTable, knownBossIds, 'boss');
  assertKnownReferences(contactSection, contactTable, knownBossIds, 'boss');
  assertKnownReferences(knockbackSection, knockbackTable, knownBossIds, 'boss');
  assertKnownReferences(phasesSection, phasesTable, knownBossIds, 'boss');
  assertKnownReferences(attacksSection, attacksTable, knownBossIds, 'boss');
  assertKnownReferences(soundsSection, soundsTable, knownBossIds, 'boss');

  return {
    sourcePath: document.filePath,
    bosses: definitions.map((definition) =>
      parseBoss(definition, {
        bodySection,
        bodyTable,
        movementSection,
        movementTable,
        contactSection,
        contactTable,
        knockbackSection,
        knockbackTable,
        phasesSection,
        phasesTable,
        attacksSection,
        attacksTable,
        soundsSection,
        soundsTable
      })
    )
  };
}

function parseBossDefinition(section: MarkdownSection): BossDefinition {
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

function parseBoss(
  definition: BossDefinition,
  tables: Readonly<{
    bodySection: MarkdownSection;
    bodyTable: MarkdownTable;
    movementSection: MarkdownSection;
    movementTable: MarkdownTable;
    contactSection: MarkdownSection;
    contactTable: MarkdownTable;
    knockbackSection: MarkdownSection;
    knockbackTable: MarkdownTable;
    phasesSection: MarkdownSection;
    phasesTable: MarkdownTable;
    attacksSection: MarkdownSection;
    attacksTable: MarkdownTable;
    soundsSection: MarkdownSection;
    soundsTable: MarkdownTable;
  }>
): ParsedBoss {
  const bodyRow = requireRow(tables.bodySection, tables.bodyTable, definition.id);
  const movementRow = requireRow(tables.movementSection, tables.movementTable, definition.id);
  const contactRow = requireRow(tables.contactSection, tables.contactTable, definition.id);
  const knockbackRow = requireRow(tables.knockbackSection, tables.knockbackTable, definition.id);
  const phaseRows = requireRows(tables.phasesSection, tables.phasesTable, definition.id);
  const attackRows = requireRows(tables.attacksSection, tables.attacksTable, definition.id);
  const soundsRow = requireRow(tables.soundsSection, tables.soundsTable, definition.id);
  const attacks = parseAttacks(tables.attacksSection, tables.attacksTable, attackRows);
  const phases = parsePhases(
    tables.phasesSection,
    tables.phasesTable,
    phaseRows,
    new Set(attacks.map((attack) => attack.key))
  );

  return {
    ...definition,
    radius: requireNumber(tables.bodySection, tables.bodyTable, bodyRow, 'radius'),
    maxHp: requireNumber(tables.bodySection, tables.bodyTable, bodyRow, 'maxHp'),
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
    phases,
    attacks,
    audio: {
      fire: readOptionalSampleIdList(tables.soundsSection, tables.soundsTable, soundsRow, 'fire'),
      phaseChange: readOptionalSampleIdList(
        tables.soundsSection,
        tables.soundsTable,
        soundsRow,
        'phaseChange'
      )
    },
    visual: definition.visual
  };
}

function assertNoForbiddenVisualGroup(balanceSection: MarkdownSection): void {
  const visualSection = balanceSection.sections.find((section) => section.title === 'Visual');
  if (visualSection !== undefined) {
    throw sectionError(visualSection, 'group "## Visual" is replaced by inline image under boss H2');
  }
}

function parsePhases(
  section: MarkdownSection,
  table: MarkdownTable,
  rows: ReadonlyArray<MarkdownTableRow>,
  attackKeys: ReadonlySet<string>
): ReadonlyArray<ParsedBossPhase> {
  const seenPhaseIds = new Set<string>();
  return rows.map((row) => {
    const phaseId = requireCell(section, table, row, 'phaseId');
    if (seenPhaseIds.has(phaseId)) {
      throw cellError(section, row.position, getRowId(row), 'phaseId', `duplicate phase "${phaseId}"`);
    }
    seenPhaseIds.add(phaseId);

    const allowedAttackIds = requireIdList(section, table, row, 'allowedAttackIds');
    for (const attackId of allowedAttackIds) {
      if (!attackKeys.has(attackId)) {
        throw cellError(
          section,
          row.position,
          getRowId(row),
          'allowedAttackIds',
          `unknown attackKey "${attackId}"`
        );
      }
    }

    return {
      id: phaseId,
      allowedAttackIds,
      exitWhenHpFractionAtOrBelow: requireNumber(
        section,
        table,
        row,
        'exitWhenHpFractionAtOrBelow'
      )
    };
  });
}

function parseAttacks(
  section: MarkdownSection,
  table: MarkdownTable,
  rows: ReadonlyArray<MarkdownTableRow>
): ReadonlyArray<ParsedBossAttack> {
  const seenAttackKeys = new Set<string>();
  return rows.map((row) => {
    const attackKey = requireCell(section, table, row, 'attackKey');
    if (seenAttackKeys.has(attackKey)) {
      throw cellError(section, row.position, getRowId(row), 'attackKey', `duplicate attack "${attackKey}"`);
    }
    seenAttackKeys.add(attackKey);

    return {
      key: attackKey,
      pattern: requireCell(section, table, row, 'pattern'),
      cooldownMs: requireNumber(section, table, row, 'cooldownMs'),
      damage: requireNumber(section, table, row, 'damage')
    };
  });
}

function requireRows(
  section: MarkdownSection,
  table: MarkdownTable,
  id: string
): ReadonlyArray<MarkdownTableRow> {
  const rows = findRowsById(section, table, id);
  if (rows.length === 0) {
    throw cellError(section, section.position, id, 'id', `expected row "${id}"`);
  }
  return rows;
}
