import type {
  MarkdownDocument,
  MarkdownCell,
  MarkdownSection,
  MarkdownTable,
  MarkdownTableRow,
  SourcePosition
} from '../parse';

export class ContentBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentBuildError';
  }
}

export function requireSection(
  container: MarkdownDocument | MarkdownSection,
  title: string
): MarkdownSection {
  const sections = 'sections' in container ? container.sections : [];
  const section = sections.find((candidate) => candidate.title === title);
  if (section !== undefined) {
    return section;
  }

  const filePath = 'filePath' in container ? container.filePath : 'content/<unknown>.md';
  throw new ContentBuildError(`${filePath}: section "${title}": expected section`);
}

export function requireRow(
  section: MarkdownSection,
  table: MarkdownTable,
  id: string
): MarkdownTableRow {
  requireIdColumn(section, table);
  const row = table.rows.find((candidate) => getRowId(candidate) === id);
  if (row !== undefined) {
    return row;
  }
  throw requirementError(section, section.position, id, 'id', `expected row "${id}"`);
}

export function requireCell(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): string {
  return requireCellNode(section, table, row, columnName).value;
}

function requireCellNode(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): MarkdownCell {
  const columnIndex = table.header.findIndex((cell) => cell.value === columnName);
  const rowId = getRowId(row);
  if (columnIndex < 0) {
    throw requirementError(
      section,
      row.position,
      rowId,
      columnName,
      `expected column "${columnName}"`
    );
  }

  const cell = row.cells[columnIndex];
  if (cell === undefined || cell.value.length === 0) {
    throw requirementError(
      section,
      cell?.position ?? row.position,
      rowId,
      columnName,
      'expected non-empty value'
    );
  }

  return cell;
}

export function requireNumber(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): number {
  const cell = requireCellNode(section, table, row, columnName);
  const value = Number(cell.value);
  if (!Number.isFinite(value)) {
    throw requirementError(section, cell.position, getRowId(row), columnName, 'expected number');
  }
  return value;
}

export function requireHexColor(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): number {
  const cell = requireCellNode(section, table, row, columnName);
  const match = /^#(?<hex>[0-9a-fA-F]{6})$/.exec(cell.value);
  if (match?.groups?.hex === undefined) {
    throw requirementError(
      section,
      cell.position,
      getRowId(row),
      columnName,
      'expected #RRGGBB color'
    );
  }
  return Number.parseInt(match.groups.hex, 16);
}

export function requireSampleIdList(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): ReadonlyArray<string> {
  const cell = requireCellNode(section, table, row, columnName);
  const sampleIds = cell.value.split(',').map((sampleId) => sampleId.trim());
  if (sampleIds.length === 0 || sampleIds.some((sampleId) => sampleId.length === 0)) {
    throw requirementError(
      section,
      cell.position,
      getRowId(row),
      columnName,
      'expected comma-separated sample ids'
    );
  }
  for (const sampleId of sampleIds) {
    if (!/^[a-z0-9][a-z0-9/_-]*$/i.test(sampleId)) {
      throw requirementError(section, cell.position, getRowId(row), columnName, 'expected sample id');
    }
  }
  return sampleIds;
}

function requireIdColumn(section: MarkdownSection, table: MarkdownTable): void {
  const idHeader = table.header[0];
  if (idHeader?.value !== 'id') {
    throw requirementError(
      section,
      idHeader?.position ?? table.position,
      '<unknown>',
      'id',
      'expected first column "id"'
    );
  }
}

function getRowId(row: MarkdownTableRow): string {
  return row.cells[0]?.value ?? '<missing id>';
}

function requirementError(
  section: MarkdownSection,
  position: SourcePosition,
  rowId: string,
  columnName: string,
  expected: string
): ContentBuildError {
  return new ContentBuildError(
    `${section.filePath}:${position.line}:${position.column}: section "${sectionLabel(section)}" row "${rowId}" column "${columnName}": ${expected}`
  );
}

function sectionLabel(section: MarkdownSection): string {
  return `${'#'.repeat(section.depth)} ${section.title}`;
}
