import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parsePlayersArea } from './parse';
import { renderPlayerContent } from './renderContent';
import { renderPlayerVisuals } from './renderVisuals';

describe('content-build players area', () => {
  it('rejects a missing players markdown source with an explicit message', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-missing-players-'));

    await expect(parsePlayersArea(join(directory, 'players.md'))).rejects.toThrow(/source not found/);
  });

  it('renders player content and visual specs from markdown', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-players-render-'));
    const sourcePath = join(directory, 'players.md');
    await writeFile(sourcePath, makePlayersMarkdown(), 'utf8');

    const area = await parsePlayersArea(sourcePath);

    expect(renderPlayerContent(area)).toContain("export const HERO: PlayerArchetype");
    expect(renderPlayerContent(area)).toContain("export const TRAINING_PLAYER: PlayerSpawn");
    expect(renderPlayerVisuals(area)).toContain("image: '/assets/hero.png'");
    expect(renderPlayerVisuals(area)).toContain('sourceSizePx: { width:');
    expect(renderPlayerVisuals(area)).toContain('worldSize: { width:');
  });

  it('rejects visual derive columns in markdown', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-players-derived-'));
    const sourcePath = join(directory, 'players.md');
    await writeFile(
      sourcePath,
      makePlayersMarkdown().replace(
        `| id | image |
|---|---|
| hero | /assets/hero.png |`,
        `| id | image | worldSize |
|---|---|---|
| hero | /assets/hero.png | { width: 1, height: 1 } |`
      ),
      'utf8'
    );

    await expect(parsePlayersArea(sourcePath)).rejects.toThrow(/derive visual field/);
  });
});

function makePlayersMarkdown(): string {
  return `# Players

## hero

| field | value |
|---|---|
| displayName | Hero |

# Balance

## Body

| id | radius |
|---|---:|
| hero | 0.5 |

## Movement

| id | maxSpeed |
|---|---:|
| hero | 6 |

## Health

| id | maxHp |
|---|---:|
| hero | 5 |

## Visual

| id | image |
|---|---|
| hero | /assets/hero.png |
`;
}
