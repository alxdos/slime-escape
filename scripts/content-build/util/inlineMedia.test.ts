import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseMarkdown, type MarkdownCell, type MarkdownSection } from '../parse';
import {
  requireInlineAudioLink,
  requireInlineAudioLinkCell,
  requireInlineImage,
  type InlineMediaSampleRegistry
} from './inlineMedia';

const SAMPLE_REGISTRY: InlineMediaSampleRegistry = {
  get(sampleId: string): Readonly<{ url: string }> | null {
    return (
      {
        'weapons/pistol': { url: '/sfx/weapons/pistol.mp3' },
        'weapons/shotgun': { url: '/sfx/weapons/shotgun.mp3' }
      } satisfies Readonly<Record<string, Readonly<{ url: string }>>>
    )[sampleId] ?? null;
  }
};

describe('inline media content-build helpers', () => {
  it('resolves an inline image under an H2 section', () => {
    const section = firstH2([
      '# Players',
      '',
      '## hero-sandbox',
      '',
      '![Hero](../public/assets/hero.png)',
      '',
      '| field | value |',
      '|-------|-------|',
      '| displayName | Hero |'
    ]);

    expect(requireInlineImage(section)).toEqual({
      url: '/assets/hero.png',
      absolutePath: resolve(process.cwd(), 'public/assets/hero.png')
    });
  });

  it('resolves an inline audio link under an H2 section', () => {
    const section = firstH2([
      '# Weapons',
      '',
      '## pistol',
      '',
      '[weapons/pistol](../public/sfx/weapons/pistol.mp3)',
      '',
      '| field | value |',
      '|-------|-------|',
      '| displayName | Pistol |'
    ]);

    expect(requireInlineAudioLink(section, SAMPLE_REGISTRY)).toEqual({
      sampleId: 'weapons/pistol',
      url: '/sfx/weapons/pistol.mp3',
      absolutePath: resolve(process.cwd(), 'public/sfx/weapons/pistol.mp3')
    });
  });

  it('validates an inline audio-link table cell and ignores plain cells', () => {
    const linkedCell = firstDataCell(
      [
        '# Sound sets',
        '',
        '## Hit',
        '',
        '| setId | s1 |',
        '|-------|----|',
        '| default | [weapons/pistol](../public/sfx/weapons/pistol.mp3) |'
      ],
      1
    );
    const plainCell = firstDataCell(
      ['# Sound sets', '', '## Hit', '', '| setId | s1 |', '|-------|----|', '| default | weapons/pistol |'],
      1
    );

    expect(
      requireInlineAudioLinkCell(linkedCell, SAMPLE_REGISTRY, {
        sourcePath: 'content/enemies.md',
        context: 'section "## Hit" row "default" column "s1"'
      })
    ).toEqual({
      sampleId: 'weapons/pistol',
      url: '/sfx/weapons/pistol.mp3',
      absolutePath: resolve(process.cwd(), 'public/sfx/weapons/pistol.mp3')
    });
    expect(requireInlineAudioLinkCell(plainCell, SAMPLE_REGISTRY)).toBeNull();
  });

  it('rejects URLs outside the required ../public/ prefix', () => {
    const section = firstH2(['# Players', '', '## hero-sandbox', '', '![Hero](/assets/hero.png)']);

    expect(() => requireInlineImage(section)).toThrow(/expected URL starting with "\.\.\/public\/"/);
  });

  it('rejects missing files under public', () => {
    const section = firstH2([
      '# Players',
      '',
      '## hero-sandbox',
      '',
      '![Hero](../public/assets/missing.png)'
    ]);

    expect(() => requireInlineImage(section)).toThrow(/media file does not exist "\/assets\/missing\.png"/);
  });

  it('rejects path rewrites inside the ../public/ URL', () => {
    const section = firstH2([
      '# Players',
      '',
      '## hero-sandbox',
      '',
      '![Hero](../public/assets/../assets/hero.png)'
    ]);

    expect(() => requireInlineImage(section)).toThrow(/expected normalized path under \.\.\/public\//);
  });

  it('rejects unknown sample ids', () => {
    const section = firstH2([
      '# Weapons',
      '',
      '## ghost',
      '',
      '[weapons/ghost](../public/sfx/weapons/pistol.mp3)'
    ]);

    expect(() => requireInlineAudioLink(section, SAMPLE_REGISTRY)).toThrow(
      /unknown sample id "weapons\/ghost"/
    );
  });

  it('rejects sample URL mismatches against the registry', () => {
    const section = firstH2([
      '# Weapons',
      '',
      '## pistol',
      '',
      '[weapons/pistol](../public/sfx/weapons/shotgun.mp3)'
    ]);

    expect(() => requireInlineAudioLink(section, SAMPLE_REGISTRY)).toThrow(
      /sample "weapons\/pistol" URL mismatch: got "\/sfx\/weapons\/shotgun\.mp3", expected "\/sfx\/weapons\/pistol\.mp3"/
    );
  });

  it('rejects a missing required H2 media node', () => {
    const section = firstH2([
      '# Players',
      '',
      '## hero-sandbox',
      '',
      '| field | value |',
      '|-------|-------|',
      '| displayName | Hero |'
    ]);

    expect(() => requireInlineImage(section)).toThrow(
      'content/example.md: section "## hero-sandbox": expected ![…](../public/…) under H2'
    );
  });
});

function firstH2(markdownLines: ReadonlyArray<string>): MarkdownSection {
  const section = parseMarkdown('content/example.md', markdownLines.join('\n')).sections[0]?.sections[0];
  if (section === undefined) {
    throw new Error('test markdown did not produce an H2 section');
  }
  return section;
}

function firstDataCell(markdownLines: ReadonlyArray<string>, cellIndex: number): MarkdownCell {
  const cell = firstH2(markdownLines).tables[0]?.rows[0]?.cells[cellIndex];
  if (cell === undefined) {
    throw new Error(`test markdown did not produce cell ${cellIndex}`);
  }
  return cell;
}
