import { statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import type { MarkdownCell, MarkdownMediaNode, MarkdownSection, SourcePosition } from '../parse';
import { ContentBuildError } from './require';

export type InlineImage = Readonly<{
  url: string;
  absolutePath: string;
}>;

export type InlineAudioLink = Readonly<{
  sampleId: string;
  url: string;
  absolutePath: string;
}>;

export type InlineMediaOptions = Readonly<{
  repositoryRoot?: string;
}>;

export type InlineAudioLinkCellOptions = InlineMediaOptions &
  Readonly<{
    sourcePath?: string;
    context?: string;
  }>;

export type InlineMediaSampleRegistry = Readonly<{
  get(sampleId: string): Readonly<{ url: string }> | null;
}>;

const PUBLIC_PREFIX = '../public/';

type ErrorContext = Readonly<{
  sourcePath: string;
  label: string;
}>;

export function requireInlineImage(
  section: MarkdownSection,
  opts: InlineMediaOptions = {}
): InlineImage {
  const node = requireSingleSectionMediaNode(
    section,
    'image',
    'expected ![…](../public/…) under H2'
  );
  return resolvePublicMediaUrl({
    rawUrl: node.url,
    position: node.position,
    context: sectionContext(section),
    repositoryRoot: opts.repositoryRoot
  });
}

export function requireInlineAudioLink(
  section: MarkdownSection,
  sampleRegistry: InlineMediaSampleRegistry,
  opts: InlineMediaOptions = {}
): InlineAudioLink {
  const node = requireSingleSectionMediaNode(
    section,
    'link',
    'expected [<sample-id>](../public/…) under H2'
  );
  return validateAudioLink({
    label: node.label,
    rawUrl: node.url,
    position: node.position,
    context: sectionContext(section),
    repositoryRoot: opts.repositoryRoot,
    sampleRegistry
  });
}

export function requireInlineAudioLinkCell(
  cell: MarkdownCell,
  sampleRegistry: InlineMediaSampleRegistry,
  opts: InlineAudioLinkCellOptions = {}
): InlineAudioLink | null {
  if (cell.inlineLink === null) {
    return null;
  }

  return validateAudioLink({
    label: cell.inlineLink.label,
    rawUrl: cell.inlineLink.url,
    position: cell.position,
    context: cellContext(cell, opts),
    repositoryRoot: opts.repositoryRoot,
    sampleRegistry
  });
}

function requireSingleSectionMediaNode<K extends MarkdownMediaNode['kind']>(
  section: MarkdownSection,
  kind: K,
  expected: string
): Extract<MarkdownMediaNode, Readonly<{ kind: K }>> {
  const nodes = section.mediaNodes.filter(
    (node): node is Extract<MarkdownMediaNode, Readonly<{ kind: K }>> => node.kind === kind
  );
  const node = nodes[0];
  if (nodes.length !== 1 || node === undefined) {
    throw new ContentBuildError(`${formatContext(sectionContext(section))}: ${expected}`);
  }
  return node;
}

function validateAudioLink(
  input: Readonly<{
    label: string;
    rawUrl: string;
    position: SourcePosition;
    context: ErrorContext;
    repositoryRoot?: string;
    sampleRegistry: InlineMediaSampleRegistry;
  }>
): InlineAudioLink {
  const sampleId = input.label;
  const resolvedUrl = resolvePublicMediaUrl(input);
  const sample = input.sampleRegistry.get(sampleId);
  if (sample === null) {
    throw mediaError(input.context, input.position, `unknown sample id "${sampleId}"`);
  }
  if (resolvedUrl.url !== sample.url) {
    throw mediaError(
      input.context,
      input.position,
      `sample "${sampleId}" URL mismatch: got "${resolvedUrl.url}", expected "${sample.url}"`
    );
  }

  return {
    sampleId,
    ...resolvedUrl
  };
}

function resolvePublicMediaUrl(
  input: Readonly<{
    rawUrl: string;
    position: SourcePosition;
    context: ErrorContext;
    repositoryRoot?: string;
  }>
): InlineImage {
  if (!input.rawUrl.startsWith(PUBLIC_PREFIX)) {
    throw mediaError(
      input.context,
      input.position,
      `expected URL starting with "${PUBLIC_PREFIX}", got "${input.rawUrl}"`
    );
  }

  const publicPath = input.rawUrl.slice(PUBLIC_PREFIX.length);
  if (!isNormalizedPublicPath(publicPath)) {
    throw mediaError(input.context, input.position, 'expected normalized path under ../public/');
  }

  const repositoryRoot = input.repositoryRoot ?? process.cwd();
  const publicRoot = resolve(repositoryRoot, 'public');
  const absolutePath = resolve(publicRoot, publicPath);
  const relativeToPublic = relative(publicRoot, absolutePath);
  if (relativeToPublic.length === 0 || relativeToPublic === '..' || relativeToPublic.startsWith('../')) {
    throw mediaError(input.context, input.position, 'expected path under ../public/');
  }

  assertExistingFile({
    absolutePath,
    context: input.context,
    position: input.position,
    publicUrl: `/${publicPath}`
  });

  return {
    url: `/${publicPath}`,
    absolutePath
  };
}

function isNormalizedPublicPath(publicPath: string): boolean {
  if (publicPath.length === 0 || publicPath.startsWith('/')) {
    return false;
  }
  return publicPath.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

function assertExistingFile(
  input: Readonly<{
    absolutePath: string;
    context: ErrorContext;
    position: SourcePosition;
    publicUrl: string;
  }>
): void {
  try {
    const stats = statSync(input.absolutePath);
    if (!stats.isFile()) {
      throw new Error('expected file');
    }
  } catch (error) {
    throw mediaError(
      input.context,
      input.position,
      `media file does not exist "${input.publicUrl}": ${formatError(error)}`
    );
  }
}

function sectionContext(section: MarkdownSection): ErrorContext {
  return {
    sourcePath: section.filePath,
    label: `section "${sectionLabel(section)}"`
  };
}

function cellContext(_cell: MarkdownCell, opts: InlineAudioLinkCellOptions): ErrorContext {
  return {
    sourcePath: opts.sourcePath ?? 'content/<unknown>.md',
    label: opts.context ?? 'inline audio-link cell'
  };
}

function mediaError(context: ErrorContext, position: SourcePosition, message: string): ContentBuildError {
  return new ContentBuildError(
    `${context.sourcePath}:${position.line}:${position.column}: ${context.label}: ${message}`
  );
}

function formatContext(context: ErrorContext): string {
  return `${context.sourcePath}: ${context.label}`;
}

function sectionLabel(section: MarkdownSection): string {
  return `${'#'.repeat(section.depth)} ${section.title}`;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
