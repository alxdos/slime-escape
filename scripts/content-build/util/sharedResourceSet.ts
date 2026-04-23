import type { MarkdownCell, MarkdownSection, MarkdownTable, MarkdownTableRow } from '../parse';
import { ContentBuildError } from './require';
import { cellError, getRowId, requireSingleTable, sectionError } from './markdown';
import {
  requireInlineAudioLinkCell,
  type InlineMediaSampleRegistry
} from './inlineMedia';

export type SharedResourceSetPartition = Readonly<{
  members: ReadonlyMap<string, string>;
  groups: ReadonlyMap<string, ReadonlyMap<string, ReadonlyArray<MarkdownCell>>>;
}>;

export type ParseSharedResourceSetPartitionOptions = Readonly<{
  archetypeIds: ReadonlyArray<string> | ReadonlySet<string>;
  membersColumnName: string;
  requiredGroups: ReadonlyArray<string>;
}>;

export type ParsedSampleIdCellGroup = Readonly<{
  form: 'plain' | 'inlineAudioLink';
  sampleIdsBySetId: ReadonlyMap<string, ReadonlyArray<string>>;
}>;

export type ParseSampleIdCellGroupOptions = Readonly<{
  sourcePath?: string;
}>;

const MEMBERS_SECTION_TITLE = 'Members';

export function parseSharedResourceSetPartition(
  partition: MarkdownSection,
  opts: ParseSharedResourceSetPartitionOptions
): SharedResourceSetPartition {
  const archetypeIds = toReadonlySet(opts.archetypeIds);
  const membersSection = requireMembersSection(partition);
  const membersTable = requireSingleTable(membersSection);
  const { members, setIds } = parseMembersTable({
    section: membersSection,
    table: membersTable,
    archetypeIds,
    membersColumnName: opts.membersColumnName
  });
  const groups = parseGroupTables(partition, setIds);

  assertEveryArchetypeHasOneSet(partition, archetypeIds, members);
  assertRequiredGroups(partition, groups, setIds, opts.requiredGroups);

  return { members, groups };
}

export function expandSetToMembers<T>(
  members: ReadonlyMap<string, string>,
  perSetValue: ReadonlyMap<string, T>
): ReadonlyMap<string, T> {
  const expanded = new Map<string, T>();
  for (const [archetypeId, setId] of members) {
    const value = perSetValue.get(setId);
    if (value === undefined) {
      throw new Error(`shared resource set "${setId}" is missing a value`);
    }
    expanded.set(archetypeId, value);
  }
  return expanded;
}

export function parseSampleIdCellGroup(
  groupName: string,
  cellsBySetId: ReadonlyMap<string, ReadonlyArray<MarkdownCell>>,
  sampleRegistry: InlineMediaSampleRegistry,
  opts: ParseSampleIdCellGroupOptions = {}
): ParsedSampleIdCellGroup {
  let form: ParsedSampleIdCellGroup['form'] | null = null;
  const sampleIdsBySetId = new Map<string, ReadonlyArray<string>>();

  for (const [setId, cells] of cellsBySetId) {
    const sampleIds: string[] = [];
    for (const cell of cells) {
      const cellForm = cell.inlineLink === null ? 'plain' : 'inlineAudioLink';
      if (form === null) {
        form = cellForm;
      } else if (form !== cellForm) {
        throw new ContentBuildError(
          `${opts.sourcePath ?? 'content/<unknown>.md'}: section "## ${groupName}": sampleId cells must not mix plain text and inline audio-link`
        );
      }

      sampleIds.push(
        cellForm === 'inlineAudioLink'
          ? requireInlineAudioLinkCell(cell, sampleRegistry, {
              sourcePath: opts.sourcePath,
              context: `section "## ${groupName}" setId "${setId}"`
            })?.sampleId ?? failInlineCellInvariant(groupName, setId)
          : requirePlainSampleIdCell(groupName, setId, cell, opts)
      );
    }
    sampleIdsBySetId.set(setId, sampleIds);
  }

  if (form === null) {
    throw new ContentBuildError(
      `${opts.sourcePath ?? 'content/<unknown>.md'}: section "## ${groupName}": expected sampleId cells`
    );
  }

  return { form, sampleIdsBySetId };
}

function parseMembersTable(
  input: Readonly<{
    section: MarkdownSection;
    table: MarkdownTable;
    archetypeIds: ReadonlySet<string>;
    membersColumnName: string;
  }>
): Readonly<{ members: ReadonlyMap<string, string>; setIds: ReadonlySet<string> }> {
  requireMembersHeader(input.section, input.table, input.membersColumnName);

  const members = new Map<string, string>();
  const setIds = new Set<string>();
  for (const row of input.table.rows) {
    const setId = requireSetId(input.section, row);
    if (setIds.has(setId)) {
      throw cellError(input.section, row.position, setId, 'setId', `duplicate setId "${setId}"`);
    }
    setIds.add(setId);

    const memberIds = requireArchetypeIdList(input.section, row, input.membersColumnName);
    for (const archetypeId of memberIds) {
      if (!input.archetypeIds.has(archetypeId)) {
        throw cellError(
          input.section,
          row.position,
          setId,
          input.membersColumnName,
          `unknown archetype id "${archetypeId}"`
        );
      }
      const currentSetId = members.get(archetypeId);
      if (currentSetId !== undefined) {
        throw cellError(
          input.section,
          row.position,
          setId,
          input.membersColumnName,
          `archetype "${archetypeId}" is a member of multiple sets: ${currentSetId}, ${setId}`
        );
      }
      members.set(archetypeId, setId);
    }
  }

  return { members, setIds };
}

function parseGroupTables(
  partition: MarkdownSection,
  knownSetIds: ReadonlySet<string>
): ReadonlyMap<string, ReadonlyMap<string, ReadonlyArray<MarkdownCell>>> {
  const groups = new Map<string, ReadonlyMap<string, ReadonlyArray<MarkdownCell>>>();
  for (const section of partition.sections) {
    if (section.title === MEMBERS_SECTION_TITLE) continue;
    const table = requireSingleTable(section);
    requireSetIdHeader(section, table);

    const rowsBySetId = new Map<string, ReadonlyArray<MarkdownCell>>();
    for (const row of table.rows) {
      const setId = requireSetId(section, row);
      if (!knownSetIds.has(setId)) {
        throw cellError(section, row.position, setId, 'setId', `unknown setId "${setId}"`);
      }
      if (rowsBySetId.has(setId)) {
        throw cellError(section, row.position, setId, 'setId', `duplicate setId "${setId}"`);
      }
      rowsBySetId.set(setId, row.cells.slice(1));
    }

    groups.set(section.title, rowsBySetId);
  }
  return groups;
}

function requireMembersSection(partition: MarkdownSection): MarkdownSection {
  const memberSections = partition.sections.filter((section) => section.title === MEMBERS_SECTION_TITLE);
  const section = memberSections[0];
  if (memberSections.length !== 1 || section === undefined) {
    throw sectionError(partition, 'expected exactly one "## Members" section');
  }
  if (partition.sections[0] !== section) {
    throw sectionError(partition, 'expected "## Members" to be the first shared resource set section');
  }
  return section;
}

function requireMembersHeader(
  section: MarkdownSection,
  table: MarkdownTable,
  membersColumnName: string
): void {
  if (table.header[0]?.value !== 'setId') {
    throw cellError(section, table.position, '<header>', 'setId', 'expected first column "setId"');
  }
  if (table.header[1]?.value !== membersColumnName) {
    throw cellError(
      section,
      table.position,
      '<header>',
      membersColumnName,
      `expected second column "${membersColumnName}"`
    );
  }
}

function requireSetIdHeader(section: MarkdownSection, table: MarkdownTable): void {
  if (table.header[0]?.value !== 'setId') {
    throw cellError(section, table.position, '<header>', 'setId', 'expected first column "setId"');
  }
}

function requireSetId(section: MarkdownSection, row: MarkdownTableRow): string {
  const setId = getRowId(row);
  if (!isId(setId)) {
    throw cellError(section, row.position, setId, 'setId', 'expected setId');
  }
  return setId;
}

function requireArchetypeIdList(
  section: MarkdownSection,
  row: MarkdownTableRow,
  columnName: string
): ReadonlyArray<string> {
  const raw = row.cells[1]?.value ?? '';
  const ids = raw.split(',').map((id) => id.trim());
  if (ids.length === 0 || ids.some((id) => id.length === 0)) {
    throw cellError(section, row.position, getRowId(row), columnName, 'expected comma-separated ids');
  }
  for (const id of ids) {
    if (!isId(id)) {
      throw cellError(section, row.position, getRowId(row), columnName, 'expected archetype id');
    }
  }
  return ids;
}

function assertEveryArchetypeHasOneSet(
  partition: MarkdownSection,
  archetypeIds: ReadonlySet<string>,
  members: ReadonlyMap<string, string>
): void {
  for (const archetypeId of archetypeIds) {
    if (!members.has(archetypeId)) {
      throw sectionError(partition, `archetype "${archetypeId}" is not a member of any set`);
    }
  }
}

function assertRequiredGroups(
  partition: MarkdownSection,
  groups: ReadonlyMap<string, ReadonlyMap<string, ReadonlyArray<MarkdownCell>>>,
  setIds: ReadonlySet<string>,
  requiredGroups: ReadonlyArray<string>
): void {
  for (const groupName of requiredGroups) {
    const group = groups.get(groupName);
    if (group === undefined) {
      throw sectionError(partition, `expected required group "${groupName}"`);
    }
    for (const setId of setIds) {
      if (!group.has(setId)) {
        throw sectionError(partition, `setId "${setId}" is missing from required group "${groupName}"`);
      }
    }
  }
}

function requirePlainSampleIdCell(
  groupName: string,
  setId: string,
  cell: MarkdownCell,
  opts: ParseSampleIdCellGroupOptions
): string {
  if (!/^[a-z0-9][a-z0-9/_-]*$/i.test(cell.value)) {
    throw new ContentBuildError(
      `${opts.sourcePath ?? 'content/<unknown>.md'}:${cell.position.line}:${cell.position.column}: section "## ${groupName}" setId "${setId}": expected sample id`
    );
  }
  return cell.value;
}

function failInlineCellInvariant(groupName: string, setId: string): never {
  throw new Error(`inline audio-link cell invariant failed in group "${groupName}" set "${setId}"`);
}

function toReadonlySet(values: ReadonlyArray<string> | ReadonlySet<string>): ReadonlySet<string> {
  return values instanceof Set ? values : new Set(values);
}

function isId(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(value);
}
