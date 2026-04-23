import { readFile } from 'node:fs/promises';

import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTable } from 'micromark-extension-gfm-table';
import type {
  Heading,
  Image,
  Link,
  Paragraph,
  PhrasingContent,
  RootContent,
  Table,
  TableCell,
  TableRow
} from 'mdast';

import { ContentBuildError } from '../util/require';

export type SourcePosition = Readonly<{
  line: number;
  column: number;
}>;

export type MarkdownCell = Readonly<{
  value: string;
  inlineLink: MarkdownInlineLink | null;
  inlineImage: MarkdownInlineImage | null;
  position: SourcePosition;
}>;

export type MarkdownInlineLink = Readonly<{
  label: string;
  url: string;
}>;

export type MarkdownInlineImage = Readonly<{
  alt?: string;
  url: string;
}>;

export type MarkdownMediaNode = Readonly<
  | {
      kind: 'image';
      alt?: string;
      url: string;
      position: SourcePosition;
    }
  | {
      kind: 'link';
      label: string;
      url: string;
      position: SourcePosition;
    }
>;

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
  mediaNodes: ReadonlyArray<MarkdownMediaNode>;
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
  mediaNodes: MarkdownMediaNode[];
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

    if (isParagraph(node) && currentH2 !== null) {
      currentH2.mediaNodes.push(...parseParagraphMediaNodes(node));
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
    mediaNodes: [],
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
    inlineLink: parseInlineLinkCell(cell),
    inlineImage: parseInlineImageCell(cell),
    position: positionOf(cell)
  }));
}

function parseParagraphMediaNodes(paragraph: Paragraph): ReadonlyArray<MarkdownMediaNode> {
  return paragraph.children.flatMap(parseMediaNode);
}

function parseMediaNode(node: PhrasingContent): ReadonlyArray<MarkdownMediaNode> {
  if (isImage(node)) {
    return [
      {
        kind: 'image',
        ...(node.alt !== null && node.alt !== undefined ? { alt: node.alt } : {}),
        url: node.url,
        position: positionOf(node)
      }
    ];
  }

  if (isLink(node)) {
    return [
      {
        kind: 'link',
        label: extractText(node).trim(),
        url: node.url,
        position: positionOf(node)
      }
    ];
  }

  return [];
}

function parseInlineLinkCell(cell: TableCell): MarkdownInlineLink | null {
  if (cell.children.length !== 1) {
    return null;
  }

  const child = cell.children[0];
  if (child === undefined || !isLink(child)) {
    return null;
  }

  return {
    label: extractText(child).trim(),
    url: child.url
  };
}

function parseInlineImageCell(cell: TableCell): MarkdownInlineImage | null {
  if (cell.children.length !== 1) {
    return null;
  }

  const child = cell.children[0];
  if (child === undefined || !isImage(child)) {
    return null;
  }

  return {
    ...(child.alt !== null && child.alt !== undefined ? { alt: child.alt } : {}),
    url: child.url
  };
}

function isHeading(node: RootContent, depth: 1 | 2): node is Heading {
  return node.type === 'heading' && node.depth === depth;
}

function isTable(node: RootContent): node is Table {
  return node.type === 'table';
}

function isParagraph(node: RootContent): node is Paragraph {
  return node.type === 'paragraph';
}

function isImage(node: PhrasingContent): node is Image {
  return node.type === 'image';
}

function isLink(node: PhrasingContent): node is Link {
  return node.type === 'link';
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
