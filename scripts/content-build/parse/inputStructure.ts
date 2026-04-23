import { readFile } from 'node:fs/promises';

import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTable } from 'micromark-extension-gfm-table';
import type { Heading, RootContent, Table, TableCell, TableRow } from 'mdast';

import { ContentBuildError } from '../util/require';

export type SourcePosition = Readonly<{
  line: number;
  column: number;
}>;

export type MarkdownCell = Readonly<{
  value: string;
  position: SourcePosition;
}>;

export type MarkdownTableRow = Readonly<{
  cells: ReadonlyArray<MarkdownCell>;
  position: SourcePosition;
}>;

export type MarkdownTable = Readonly<{
  header: ReadonlyArray<MarkdownCell>;
  rows: ReadonlyArray<MarkdownTableRow>;
  position: SourcePosition;
}>;

export type MarkdownSection = Readonly<{
  filePath: string;
  depth: 1 | 2;
  title: string;
  position: SourcePosition;
  tables: ReadonlyArray<MarkdownTable>;
  sections: ReadonlyArray<MarkdownSection>;
}>;

export type MarkdownDocument = Readonly<{
  filePath: string;
  sections: ReadonlyArray<MarkdownSection>;
}>;

type MutableMarkdownSection = {
  filePath: string;
  depth: 1 | 2;
  title: string;
  position: SourcePosition;
  tables: MarkdownTable[];
  sections: MutableMarkdownSection[];
};

export async function parseMarkdownFile(filePath: string): Promise<MarkdownDocument> {
  return parseMarkdown(filePath, await readFile(filePath, 'utf8'));
}

export function parseMarkdown(filePath: string, markdown: string): MarkdownDocument {
  const root = fromMarkdown(markdown, {
    extensions: [gfmTable()],
    mdastExtensions: [gfmTableFromMarkdown()]
  });

  const sections: MutableMarkdownSection[] = [];
  let currentH1: MutableMarkdownSection | null = null;
  let currentH2: MutableMarkdownSection | null = null;

  for (const node of root.children) {
    if (isHeading(node, 1)) {
      currentH1 = createSection(filePath, node, 1);
      currentH2 = null;
      sections.push(currentH1);
      continue;
    }

    if (isHeading(node, 2)) {
      if (currentH1 === null) {
        throw parseError(filePath, node, 'H2 section must be nested under an H1 section');
      }
      currentH2 = createSection(filePath, node, 2);
      currentH1.sections.push(currentH2);
      continue;
    }

    if (isTable(node)) {
      const table = parseTable(filePath, node);
      if (currentH2 !== null) {
        currentH2.tables.push(table);
        continue;
      }
      if (currentH1 !== null) {
        currentH1.tables.push(table);
        continue;
      }
      throw parseError(filePath, node, 'GFM table must be nested under an H1 or H2 section');
    }
  }

  return { filePath, sections };
}

function createSection(
  filePath: string,
  heading: Heading,
  depth: 1 | 2
): MutableMarkdownSection {
  return {
    filePath,
    depth,
    title: extractText(heading).trim(),
    position: positionOf(heading),
    tables: [],
    sections: []
  };
}

function parseTable(filePath: string, table: Table): MarkdownTable {
  const headerRow = table.children[0];
  if (headerRow === undefined) {
    throw parseError(filePath, table, 'markdown table is missing a header row');
  }

  return {
    header: parseTableCells(headerRow.children),
    rows: table.children.slice(1).map(parseTableRow),
    position: positionOf(table)
  };
}

function parseTableRow(row: TableRow): MarkdownTableRow {
  return {
    cells: parseTableCells(row.children),
    position: positionOf(row)
  };
}

function parseTableCells(cells: ReadonlyArray<TableCell>): ReadonlyArray<MarkdownCell> {
  return cells.map((cell) => ({
    value: extractText(cell).trim(),
    position: positionOf(cell)
  }));
}

function isHeading(node: RootContent, depth: 1 | 2): node is Heading {
  return node.type === 'heading' && node.depth === depth;
}

function isTable(node: RootContent): node is Table {
  return node.type === 'table';
}

function parseError(filePath: string, node: RootContent, message: string): ContentBuildError {
  const position = positionOf(node);
  return new ContentBuildError(`${filePath}:${position.line}:${position.column}: ${message}`);
}

function positionOf(node: { position?: { start?: { line?: number; column?: number } } }): SourcePosition {
  return {
    line: node.position?.start?.line ?? 1,
    column: node.position?.start?.column ?? 1
  };
}

function extractText(node: unknown): string {
  if (!isRecord(node)) {
    return '';
  }

  const value = node.value;
  if (typeof value === 'string') {
    return value;
  }

  const children = node.children;
  if (!Array.isArray(children)) {
    return '';
  }

  return children.map(extractText).join('');
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}
