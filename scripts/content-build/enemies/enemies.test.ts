import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runContentBuild, type ContentArea } from '../index';
import { parseEnemiesArea } from './parse';
import { renderEnemyAudio } from './renderAudio';
import { renderEnemyContent } from './renderContent';
import { renderEnemyVisuals } from './renderVisuals';

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
    await writeFile(sourcePath, makeEnemiesMarkdown({ runnerMaxSpeed: '' }), 'utf8');
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

  it('allows multiple drop rows for one enemy', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-multi-drop-'));
    const sourcePath = join(directory, 'enemies.md');
    await writeFile(sourcePath, makeEnemiesMarkdown({ extraRunnerDropArchetypeId: 'size-up' }), 'utf8');

    const area = await parseEnemiesArea(sourcePath);
    const runner = area.enemies.find((enemy) => enemy.id === 'slime-one-eye');

    expect(runner?.dropTable).toEqual([
      { archetypeId: 'heal-orb', chance: 0.25 },
      { archetypeId: 'size-up', chance: 0.1 }
    ]);
  });

  it('renders visual specs from PNG image paths', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-enemy-visuals-'));
    const sourcePath = join(directory, 'enemies.md');
    await writeFile(sourcePath, makeEnemiesMarkdown(), 'utf8');

    const area = await parseEnemiesArea(sourcePath);
    expect(renderEnemyContent(area)).toContain('contactBox: { width:');
    const visuals = renderEnemyVisuals(area);

    expect(visuals).toContain("export const SLIME_ONE_EYE_VISUAL: SpriteVisualSpec");
    expect(visuals).toContain("image: '/assets/slime-01.png'");
    expect(visuals).toContain('sourceSizePx: { width:');
    expect(visuals).toContain('ENEMY_VISUAL_SPECS');
  });

  it('rejects enemies without required inline image nodes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-enemy-missing-image-'));
    const sourcePath = join(directory, 'enemies.md');
    await writeFile(
      sourcePath,
      makeEnemiesMarkdown().replace('![One-Eye Slime](../public/assets/slime-01.png)\n\n', ''),
      'utf8'
    );

    await expect(parseEnemiesArea(sourcePath)).rejects.toThrow(/expected !\[…\]/);
  });

  it('rejects legacy enemy Visual balance groups', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-enemy-visual-group-'));
    const sourcePath = join(directory, 'enemies.md');
    await writeFile(
      sourcePath,
      addLegacyBalanceGroup(
        makeEnemiesMarkdown(),
        'Visual',
        '| id | image |\n|---|---|\n| slime-one-eye | /assets/slime-01.png |'
      ),
      'utf8'
    );

    await expect(parseEnemiesArea(sourcePath)).rejects.toThrow(/replaced by inline image/);
  });

  it('rejects legacy enemy Sounds balance groups', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-enemy-sounds-group-'));
    const sourcePath = join(directory, 'enemies.md');
    await writeFile(
      sourcePath,
      addLegacyBalanceGroup(
        makeEnemiesMarkdown(),
        'Sounds',
        '| id | hit | death |\n|---|---|---|\n| slime-one-eye | slimes/hit-1 | slimes/death-1 |'
      ),
      'utf8'
    );

    await expect(parseEnemiesArea(sourcePath)).rejects.toThrow(/replaced by # Sound sets/);
  });

  it('rejects legacy enemy Voice balance groups', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-enemy-voice-group-'));
    const sourcePath = join(directory, 'enemies.md');
    await writeFile(
      sourcePath,
      addLegacyBalanceGroup(
        makeEnemiesMarkdown(),
        'Voice',
        '| id | sampleIds | intervalMinMs | intervalMaxMs |\n|---|---|---:|---:|\n| slime-one-eye | slimes/voice-1 | 3000 | 6000 |'
      ),
      'utf8'
    );

    await expect(parseEnemiesArea(sourcePath)).rejects.toThrow(/replaced by # Sound sets/);
  });

  it('rejects unexpected enemy sound-set groups', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-enemy-extra-sound-set-'));
    const sourcePath = join(directory, 'enemies.md');
    await writeFile(
      sourcePath,
      addSoundSetGroup(
        makeEnemiesMarkdown(),
        'Preview',
        '| setId | s1 |\n|---|---|\n| default | [slimes/hit-1](../public/sfx/slimes/slime-1.mp3) |'
      ),
      'utf8'
    );

    await expect(parseEnemiesArea(sourcePath)).rejects.toThrow(/unexpected sound-set section/);
  });

  it('rejects duplicate enemy sound-set groups', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-enemy-duplicate-sound-set-'));
    const sourcePath = join(directory, 'enemies.md');
    await writeFile(
      sourcePath,
      addSoundSetGroup(
        makeEnemiesMarkdown(),
        'Hit',
        '| setId | s1 | s2 | s3 | s4 |\n|---|---|---|---|---|\n| default | [slimes/hit-1](../public/sfx/slimes/slime-1.mp3) | [slimes/hit-2](../public/sfx/slimes/slime-2.mp3) | [slimes/hit-3](../public/sfx/slimes/slime-3.mp3) | [slimes/hit-4](../public/sfx/slimes/slime-4.mp3) |'
      ),
      'utf8'
    );

    await expect(parseEnemiesArea(sourcePath)).rejects.toThrow(/duplicate sound-set section/);
  });

  it('rejects duplicate enemy/drop pairs in the drops table', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-duplicate-drop-'));
    const sourcePath = join(directory, 'enemies.md');
    await writeFile(
      sourcePath,
      makeEnemiesMarkdown({ extraRunnerDropArchetypeId: 'heal-orb' }),
      'utf8'
    );

    await expect(parseEnemiesArea(sourcePath)).rejects.toThrow(/duplicate drop pair/);
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

function addLegacyBalanceGroup(markdown: string, title: string, table: string): string {
  return markdown.replace('\n# Sound sets\n', `\n## ${title}\n\n${table}\n\n# Sound sets\n`);
}

function addSoundSetGroup(markdown: string, title: string, table: string): string {
  return `${markdown}\n## ${title}\n\n${table}\n`;
}

function makeEnemiesMarkdown(
  options: Readonly<{
    runnerMaxSpeed?: string;
    extraBodyRowId?: string;
    extraRunnerDropArchetypeId?: string;
  }> = {}
): string {
  const runnerMaxSpeed = options.runnerMaxSpeed ?? '4';
  const extraBodyRow =
    options.extraBodyRowId === undefined
      ? ''
      : `| ${options.extraBodyRowId} | 0.5 | 1 | chase |\n`;
  const extraRunnerDropRow =
    options.extraRunnerDropArchetypeId === undefined
      ? ''
      : `| slime-one-eye | ${options.extraRunnerDropArchetypeId} | 0.1 |\n`;

  return `# Enemies

## test-stationary

![Test Stationary](../public/assets/slime-05.png)

| field | value |
|---|---|
| displayName | Test Stationary |
| color | #ff7766 |

## slime-one-eye

![One-Eye Slime](../public/assets/slime-01.png)

| field | value |
|---|---|
| displayName | One-Eye Slime |
| color | #77ff99 |

# Balance

## Body

| id | radius | maxHp | behavior |
|---|---:|---:|---|
| test-stationary | 0.6 | 3 | stationary |
| slime-one-eye | 0.4 | 1 | chase |
${extraBodyRow}
## Movement

| id | maxSpeed |
|---|---:|
| test-stationary | 0 |
| slime-one-eye | ${runnerMaxSpeed} |

## Contact damage

| id | contactDamage | contactCooldownMs |
|---|---:|---:|
| test-stationary | 0 | 1 |
| slime-one-eye | 1 | 800 |

## Knockback

| id | baseImpulse | velocityScale | durationMs |
|---|---:|---:|---:|
| test-stationary | 0 | 0 | 1 |
| slime-one-eye | 8 | 1.5 | 350 |

## Drops

| id | dropArchetypeId | chance |
|---|---|---:|
| slime-one-eye | heal-orb | 0.25 |
${extraRunnerDropRow}

## Carrier Drops

| id | guaranteedDropArchetypeIds |
|---|---|
| test-stationary | none |
| slime-one-eye | none |

## Retaliation

| id | enabled | durationMs |
|---|---|---:|
| test-stationary | false | 0 |
| slime-one-eye | false | 0 |

# Sound sets

## Members

| setId | slimes |
|---|---|
| default | test-stationary, slime-one-eye |

## Hit

| setId | s1 | s2 | s3 | s4 |
|---|---|---|---|---|
| default | [slimes/hit-1](../public/sfx/slimes/slime-1.mp3) | [slimes/hit-2](../public/sfx/slimes/slime-2.mp3) | [slimes/hit-3](../public/sfx/slimes/slime-3.mp3) | [slimes/hit-4](../public/sfx/slimes/slime-4.mp3) |

## Death

| setId | s1 | s2 | s3 | s4 |
|---|---|---|---|---|
| default | [slimes/death-1](../public/sfx/slimes/slime-1.mp3) | [slimes/death-2](../public/sfx/slimes/slime-2.mp3) | [slimes/death-3](../public/sfx/slimes/slime-3.mp3) | [slimes/death-4](../public/sfx/slimes/slime-4.mp3) |

## Voice

| setId | s1 | s2 | s3 | s4 |
|---|---|---|---|---|
| default | [slimes/voice-1](../public/sfx/slimes/slime-1.mp3) | [slimes/voice-2](../public/sfx/slimes/slime-2.mp3) | [slimes/voice-3](../public/sfx/slimes/slime-3.mp3) | [slimes/voice-4](../public/sfx/slimes/slime-4.mp3) |
`;
}
