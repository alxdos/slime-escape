import { describe, expect, it } from 'vitest';

import { parseMarkdown } from './inputStructure';

describe('content-build input structure parser', () => {
  it('collects H2 paragraph media nodes without semantic validation', () => {
    const document = parseMarkdown(
      'content/example.md',
      [
        '# Weapons',
        '',
        '## pistol',
        '',
        '![Pistol sprite](../public/assets/pistol.png)',
        '',
        '[weapons/pistol](../public/audio/weapons/pistol.mp3)',
        '',
        '| field | value |',
        '|-------|-------|',
        '| displayName | Pistol |'
      ].join('\n')
    );

    const section = document.sections[0]?.sections[0];

    expect(section?.mediaNodes).toEqual([
      {
        kind: 'image',
        alt: 'Pistol sprite',
        url: '../public/assets/pistol.png',
        position: { line: 5, column: 1 }
      },
      {
        kind: 'link',
        label: 'weapons/pistol',
        url: '../public/audio/weapons/pistol.mp3',
        position: { line: 7, column: 1 }
      }
    ]);
  });

  it('stores inline media only when a table cell is exactly one markdown media node', () => {
    const document = parseMarkdown(
      'content/example.md',
      [
        '# Sound sets',
        '',
        '## Hit',
        '',
        '| setId | linked | image | plain | mixed |',
        '|-------|--------|-------|-------|-------|',
        '| default | [slimes/hit-1](../public/audio/slimes/hit-1.mp3) | ![Background](../public/images/bg/bg-01.jpg) | slimes/hit-2 | prefix [slimes/hit-3](../public/audio/slimes/hit-3.mp3) |'
      ].join('\n')
    );

    const cells = document.sections[0]?.sections[0]?.tables[0]?.rows[0]?.cells;

    expect(cells?.[1]?.value).toBe('slimes/hit-1');
    expect(cells?.[1]?.inlineLink).toEqual({
      label: 'slimes/hit-1',
      url: '../public/audio/slimes/hit-1.mp3'
    });
    expect(cells?.[2]?.value).toBe('');
    expect(cells?.[2]?.inlineImage).toEqual({
      alt: 'Background',
      url: '../public/images/bg/bg-01.jpg'
    });
    expect(cells?.[3]?.inlineLink).toBeNull();
    expect(cells?.[4]?.inlineLink).toBeNull();
    expect(cells?.[4]?.inlineImage).toBeNull();
  });
});
