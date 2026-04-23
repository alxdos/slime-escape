import {
  parseMarkdownFile,
  type MarkdownDocument,
  type MarkdownSection,
  type MarkdownTable,
  type MarkdownTableRow,
  type SourcePosition
} from '../parse';
import { ContentBuildError, requireCell, requireSampleIdList } from './require';

export async function readMarkdownDocument(sourcePath: string): Promise<MarkdownDocument> {
  try {
    return await parseMarkdownFile(sourcePath);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new ContentBuildError(`${sourcePath}: source not found`);
    }
    throw error;
  }
}

export function requireSingleTable(section: MarkdownSection): MarkdownTable {
  const table = section.tables[0];
  if (table === undefined) {
    throw sectionError(section, 'expected a GFM table');
  }
  if (section.tables.length > 1) {
    throw sectionError(section, 'expected exactly one GFM table');
  }
  return table;
}

export function requireField(section: MarkdownSection, table: MarkdownTable, fieldName: string): string {
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

export function requireFieldHexColor(
  section: MarkdownSection,
  table: MarkdownTable,
  fieldName: string
): number {
  const raw = requireField(section, table, fieldName);
  const row = findFieldRow(table, fieldName);
  const match = /^#(?<hex>[0-9a-fA-F]{6})$/.exec(raw);
  if (match?.groups?.hex === undefined) {
    throw cellError(section, row?.position ?? section.position, fieldName, 'value', 'expected #RRGGBB color');
  }
  return Number.parseInt(match.groups.hex, 16);
}

export function findRowById(
  section: MarkdownSection,
  table: MarkdownTable,
  id: string
): MarkdownTableRow | null {
  requireIdHeader(section, table);
  return table.rows.find((row) => getRowId(row) === id) ?? null;
}

export function findRowsById(
  section: MarkdownSection,
  table: MarkdownTable,
  id: string
): ReadonlyArray<MarkdownTableRow> {
  requireIdHeader(section, table);
  return table.rows.filter((row) => getRowId(row) === id);
}

export function assertKnownReferences(
  section: MarkdownSection,
  table: MarkdownTable,
  knownIds: ReadonlySet<string>,
  entityLabel: string
): void {
  requireIdHeader(section, table);
  for (const row of table.rows) {
    const rowId = getRowId(row);
    if (!knownIds.has(rowId)) {
      throw cellError(section, row.position, rowId, 'id', `unknown ${entityLabel} id "${rowId}"`);
    }
  }
}

export function readOptionalSampleIdList(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): ReadonlyArray<string> {
  const columnIndex = table.header.findIndex((cell) => cell.value === columnName);
  if (columnIndex < 0) {
    throw cellError(section, row.position, getRowId(row), columnName, `expected column "${columnName}"`);
  }
  const raw = row.cells[columnIndex]?.value ?? '';
  if (raw.length === 0) {
    return [];
  }
  return requireSampleIdList(section, table, row, columnName);
}

export function requireIdList(
  section: MarkdownSection,
  table: MarkdownTable,
  row: MarkdownTableRow,
  columnName: string
): ReadonlyArray<string> {
  const raw = requireCell(section, table, row, columnName);
  const ids = raw.split(',').map((id) => id.trim());
  if (ids.length === 0 || ids.some((id) => id.length === 0)) {
    throw cellError(section, row.position, getRowId(row), columnName, 'expected comma-separated ids');
  }
  for (const id of ids) {
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) {
      throw cellError(section, row.position, getRowId(row), columnName, 'expected id');
    }
  }
  return ids;
}

export function getRowId(row: MarkdownTableRow): string {
  return row.cells[0]?.value ?? '<missing id>';
}

export function sectionError(section: MarkdownSection, expected: string): ContentBuildError {
  return new ContentBuildError(
    `${section.filePath}:${section.position.line}:${section.position.column}: section "${sectionLabel(
      section
    )}": ${expected}`
  );
}

export function cellError(
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

function requireFieldValueHeader(section: MarkdownSection, table: MarkdownTable): void {
  if (table.header[0]?.value !== 'field' || table.header[1]?.value !== 'value') {
    throw cellError(section, table.position, '<header>', 'field/value', 'expected field/value table');
  }
}

function findFieldRow(table: MarkdownTable, fieldName: string): MarkdownTableRow | null {
  return table.rows.find((row) => row.cells[0]?.value === fieldName) ?? null;
}

function requireIdHeader(section: MarkdownSection, table: MarkdownTable): void {
  if (table.header[0]?.value !== 'id') {
    throw cellError(section, table.position, '<header>', 'id', 'expected first column "id"');
  }
}

function sectionLabel(section: MarkdownSection): string {
  return `${'#'.repeat(section.depth)} ${section.title}`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
