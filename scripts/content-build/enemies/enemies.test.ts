import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runContentBuild, type ContentArea } from '../index';
import { parseEnemiesArea } from './parse';
import { renderEnemyAudio } from './renderAudio';
import { renderEnemyContent } from './renderContent';

describe('content-build enemies area', () => {
  it('renders the committed enemies markdown to the committed generated files', async () => {
    const area = await parseEnemiesArea('content/enemies.md');

    await expect(readFile('src/shared/content/enemies.generated.ts', 'utf8')).resolves.toBe(
      renderEnemyContent(area)
    );
    await expect(readFile('src/main/audio/enemyAudio.generated.ts', 'utf8')).resolves.toBe(
      renderEnemyAudio(area)
    );
  });

  it('rejects a missing required cell before modifying targets', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-missing-cell-'));
    const sourcePath = join(directory, 'enemies.md');
    const targetPath = join(directory, 'enemies.generated.ts');
    await writeFile(sourcePath, makeEnemiesMarkdown({ fastMaxSpeed: '' }), 'utf8');
    await writeFile(targetPath, 'old target', 'utf8');

    const area = makeArea('missing-cell', async () => {
      const parsed = await parseEnemiesArea(sourcePath);
      return [{ path: targetPath, contents: renderEnemyContent(parsed) }];
    });

    await expect(runContentBuild('build', [area])).rejects.toThrow(/column "maxSpeed"/);
    await expect(readFile(targetPath, 'utf8')).resolves.toBe('old target');
  });

  it('rejects a balance row that references an unknown enemy id', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-unknown-id-'));
    const sourcePath = join(directory, 'enemies.md');
    await writeFile(sourcePath, makeEnemiesMarkdown({ extraBodyRowId: 'slime-ghost' }), 'utf8');

    await expect(parseEnemiesArea(sourcePath)).rejects.toThrow(/unknown enemy id "slime-ghost"/);
  });

  it('fails check mode when a generated target has drifted', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-drift-'));
    const targetPath = join(directory, 'target.generated.ts');
    await writeFile(targetPath, 'stale', 'utf8');

    const area = makeArea('drift', async () => [{ path: targetPath, contents: 'fresh' }]);

    await expect(runContentBuild('check', [area])).rejects.toThrow(/- stale\n\+ fresh/);
    await expect(readFile(targetPath, 'utf8')).resolves.toBe('stale');
  });

  it('does not partially write one area when another area fails during render', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-atomicity-'));
    const targetPath = join(directory, 'target.generated.ts');
    await writeFile(targetPath, 'old target', 'utf8');

    const goodArea = makeArea('good', async () => [{ path: targetPath, contents: 'new target' }]);
    const brokenArea = makeArea('broken', async () => {
      throw new Error('synthetic render failure');
    });

    await expect(runContentBuild('build', [goodArea, brokenArea])).rejects.toThrow(
      /synthetic render failure/
    );
    await expect(readFile(targetPath, 'utf8')).resolves.toBe('old target');
  });
});

function makeArea(name: string, render: ContentArea['render']): ContentArea {
  return { name, render };
}

function makeEnemiesMarkdown(
  options: Readonly<{
    fastMaxSpeed?: string;
    extraBodyRowId?: string;
  }> = {}
): string {
  const fastMaxSpeed = options.fastMaxSpeed ?? '4';
  const extraBodyRow =
    options.extraBodyRowId === undefined
      ? ''
      : `| ${options.extraBodyRowId} | 0.5 | 1 | chase |\n`;

  return `# Enemies

## training-target

| field | value |
|---|---|
| displayName | Training Target |
| color | #ff7766 |

## slime-fast

| field | value |
|---|---|
| displayName | Fast Slime |
| color | #77ff99 |

# Balance

## Body

| id | radius | maxHp | behavior |
|---|---:|---:|---|
| training-target | 0.6 | 3 | stationary |
| slime-fast | 0.4 | 1 | chase |
${extraBodyRow}
## Movement

| id | maxSpeed |
|---|---:|
| training-target | 0 |
| slime-fast | ${fastMaxSpeed} |

## Contact damage

| id | contactDamage | contactCooldownMs |
|---|---:|---:|
| training-target | 0 | 1 |
| slime-fast | 1 | 800 |

## Knockback

| id | baseImpulse | velocityScale | durationMs |
|---|---:|---:|---:|
| training-target | 0 | 0 | 1 |
| slime-fast | 8 | 1.5 | 350 |

## Drops

| id | dropArchetypeId | chance |
|---|---|---:|
| slime-fast | heal-orb | 0.25 |

## Sounds

| id | hit | death |
|---|---|---|
| training-target | | |
| slime-fast | slimes/hit-1, slimes/hit-2 | slimes/hit-1, slimes/hit-2 |

## Voice

| id | sampleIds | intervalMinMs | intervalMaxMs |
|---|---|---:|---:|
| slime-fast | slimes/hit-1, slimes/hit-2 | 3000 | 6000 |
`;
}
