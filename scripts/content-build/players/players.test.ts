import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runContentBuild, type ContentArea } from '../index';
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

    expect(renderPlayerContent(area)).toContain('export const HERO_SANDBOX = {');
    expect(renderPlayerContent(area)).toContain('export const HERO_TRAINING = {');
    expect(renderPlayerContent(area)).toContain(
      'export const PLAYER_ARCHETYPE_SPECS = [HERO_SANDBOX, HERO_TRAINING]'
    );
    expect(renderPlayerContent(area)).toContain('radius: 1.1458333333333333');
    expect(renderPlayerContent(area)).toContain('maxHp: HERO_SANDBOX.maxHp');
    expect(renderPlayerContent(area)).toContain('contactBox: { width:');
    expect(renderPlayerContent(area)).toContain('export const TRAINING_PLAYER = {');
    expect(renderPlayerVisuals(area)).toContain("export const HERO_SANDBOX_VISUAL: SpriteVisualSpec");
    expect(renderPlayerVisuals(area)).toContain("export const HERO_TRAINING_VISUAL: SpriteVisualSpec");
    expect(renderPlayerVisuals(area)).toContain(
      'export const PLAYER_VISUAL_SPECS = [HERO_SANDBOX_VISUAL, HERO_TRAINING_VISUAL]'
    );
    expect(renderPlayerVisuals(area)).toContain("image: '/assets/hero.png'");
    expect(renderPlayerVisuals(area)).toContain('sourceSizePx: { width:');
    expect(renderPlayerVisuals(area)).toContain('worldSize: { width:');
  });

  it('rejects players without required inline image nodes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-players-derived-'));
    const sourcePath = join(directory, 'players.md');
    await writeFile(sourcePath, makePlayersMarkdown().replace('![Hero](../public/assets/hero.png)\n\n', ''), 'utf8');

    await expect(parsePlayersArea(sourcePath)).rejects.toThrow(/expected !\[…\]/);
  });

  it('rejects legacy player Visual balance groups', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-players-visual-group-'));
    const sourcePath = join(directory, 'players.md');
    await writeFile(
      sourcePath,
      `${makePlayersMarkdown()}\n## Visual\n\n| id | image |\n|---|---|\n| hero-sandbox | /assets/hero.png |\n`,
      'utf8'
    );

    await expect(parsePlayersArea(sourcePath)).rejects.toThrow(/replaced by inline image/);
  });

  it('rejects legacy player Body balance groups', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-players-body-group-'));
    const sourcePath = join(directory, 'players.md');
    await writeFile(
      sourcePath,
      `${makePlayersMarkdown()}\n## Body\n\n| id | radius |\n|---|---:|\n| hero-sandbox | 0.5 |\n`,
      'utf8'
    );

    await expect(parsePlayersArea(sourcePath)).rejects.toThrow(/derived from inline player images/);
  });

  it('rejects legacy player sprite fields under player definitions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-players-radius-field-'));
    const sourcePath = join(directory, 'players.md');
    await writeFile(
      sourcePath,
      makePlayersMarkdown().replace('| displayName | Hero |', '| displayName | Hero |\n| radius | 0.5 |'),
      'utf8'
    );

    await expect(parsePlayersArea(sourcePath)).rejects.toThrow(/sprite body fields are derived/);
  });

  it('fails check mode when PNG-derived player visual output drifts from the committed target', async () => {
    const area = await parsePlayersArea('content/players.md');
    const directory = await mkdtemp(join(tmpdir(), 'content-build-players-visual-drift-'));
    const targetPath = join(directory, 'playerVisuals.generated.ts');
    const staleTarget = renderPlayerVisuals(area).replace(
      'sourceSizePx: { width: 294, height: 550 }',
      'sourceSizePx: { width: 295, height: 550 }'
    );
    await writeFile(targetPath, staleTarget, 'utf8');

    const driftArea = makeArea('players-visual-drift', async () => [
      { path: targetPath, contents: renderPlayerVisuals(area) }
    ]);

    await expect(runContentBuild('check', [driftArea])).rejects.toThrow(/294/);
    await expect(readFile(targetPath, 'utf8')).resolves.toContain(
      'sourceSizePx: { width: 295, height: 550 }'
    );
  });
});

function makeArea(name: string, render: ContentArea['render']): ContentArea {
  return { name, render };
}

function makePlayersMarkdown(): string {
  return `# Players

## hero-sandbox

![Hero](../public/assets/hero.png)

| field | value |
|---|---|
| displayName | Hero |

## hero-training

![Hero](../public/assets/hero.png)

| field | value |
|---|---|
| displayName | Hero |

# Balance

## Movement

| id | maxSpeed |
|---|---:|
| hero-sandbox | 6 |
| hero-training | 6 |

## Health

| id | maxHp |
|---|---:|
| hero-sandbox | 1 |
| hero-training | 5 |
`;
}
