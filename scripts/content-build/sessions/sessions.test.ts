import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runContentBuild, type ContentArea } from '../index';
import { parseSessionsArea, validateUniqueSessionPresetIds } from './parse';
import { renderSessionContent } from './renderContent';

const SESSION_SOURCE_FILES = [
  'campaign.md',
  'sandbox.md',
  'sandbox-with-combat.md',
  'training.md'
] as const;

type SessionSourceFile = (typeof SESSION_SOURCE_FILES)[number];
type SessionMutations = Partial<Record<SessionSourceFile, (source: string) => string>>;

describe('content-build sessions area', () => {
  it('renders committed sessions markdown to the committed generated file', async () => {
    const area = await parseSessionsArea('content/sessions');

    await expect(readFile('src/shared/content/sessions.generated.ts', 'utf8')).resolves.toBe(
      renderSessionContent(area)
    );
  });

  it('rejects a missing required session cell before modifying targets', async () => {
    const fixture = await copySessionsFixture({
      'training.md': (source) => removeExact(source, '| displayName | Тренировка |\n')
    });
    const targetPath = join(fixture.directory, 'sessions.generated.ts');
    await writeFile(targetPath, 'old target', 'utf8');

    const area = makeArea('sessions-missing-cell', async () => [
      {
        path: targetPath,
        contents: renderSessionContent(await parseSessionsArea(fixture.sourceDirectory))
      }
    ]);

    await expect(runContentBuild('build', [area])).rejects.toThrow(/expected field "displayName"/);
    await expect(readFile(targetPath, 'utf8')).resolves.toBe('old target');
  });

  for (const testCase of [
    {
      name: 'spawnKind',
      file: 'training.md' as const,
      mutate: (source: string) =>
        replaceExact(source, '| spawnKind | wave |', '| spawnKind | swarm |'),
      pattern: /expected one of: empty, wave, static, boss/
    },
    {
      name: 'zoneKind',
      file: 'training.md' as const,
      mutate: (source: string) =>
        replaceExact(source, '| zoneKind | shrinkLinear |', '| zoneKind | squeeze |'),
      pattern: /expected one of: disabled, shrinkLinear, expandLinear/
    },
    {
      name: 'transitionKind',
      file: 'training.md' as const,
      mutate: (source: string) =>
        replaceExact(
          source,
          '| transitionKind | allEnemiesCleared |',
          '| transitionKind | done |'
        ),
      pattern: /expected one of: never, allEnemiesCleared, timer/
    }
  ]) {
    it(`rejects a typo in ${testCase.name}`, async () => {
      await expectParseRejects({
        [testCase.file]: testCase.mutate
      }, testCase.pattern);
    });
  }

  for (const testCase of [
    {
      name: 'arenaId',
      file: 'campaign.md' as const,
      mutate: (source: string) => replaceExact(source, '| arenaId | sandbox |', '| arenaId | sndbox |'),
      pattern: /section "# Session": unknown arenaId "sndbox"/
    },
    {
      name: 'playerId',
      file: 'campaign.md' as const,
      mutate: (source: string) =>
        replaceExact(source, '| playerId | hero-training |', '| playerId | hero-ghost |'),
      pattern: /section "# Session": unknown playerId "hero-ghost"/
    },
    {
      name: 'loadoutWeaponIds',
      file: 'campaign.md' as const,
      mutate: (source: string) =>
        replaceExact(source, '| loadoutWeaponIds | pistol, shotgun, smg |', '| loadoutWeaponIds | pistol, railgun, smg |'),
      pattern: /section "# Session": unknown loadoutWeaponIds "railgun"/
    },
    {
      name: 'bossArchetypeId',
      file: 'campaign.md' as const,
      mutate: (source: string) =>
        replaceExact(
          source,
          '| bossArchetypeId | boss-scrap-king |',
          '| bossArchetypeId | boss-missing |'
        ),
      pattern: /section "## campaign-set-3-boss": unknown bossArchetypeId "boss-missing"/
    },
    {
      name: 'archetypeId',
      file: 'training.md' as const,
      mutate: (source: string) =>
        replaceExact(source, '| 1 | slime-one-eye |', '| 1 | slime-ghost |'),
      pattern: /section "## training-wave-1": unknown archetypeId "slime-ghost"/
    }
  ]) {
    it(`rejects an unknown cross-area ${testCase.name}`, async () => {
      await expectParseRejects({
        [testCase.file]: testCase.mutate
      }, testCase.pattern);
    });
  }

  it('rejects a spawn table on an empty encounter', async () => {
    await expectParseRejects(
      {
        'sandbox.md': (source) => `${source}\n| seq | archetypeId |\n|---:|---|\n| 1 | slime-one-eye |\n`
      },
      /spawnKind "empty" forbids seq\/archetypeId table/
    );
  });

  it('rejects a spawn table on a boss encounter', async () => {
    await expectParseRejects(
      {
        'campaign.md': (source) => `${source}\n| seq | archetypeId |\n|---:|---|\n| 1 | slime-one-eye |\n`
      },
      /spawnKind "boss" forbids seq\/archetypeId table/
    );
  });

  it('rejects a missing spawn table for a wave encounter', async () => {
    await expectParseRejects(
      {
        'training.md': (source) => removeExact(source, TRAINING_WAVE_1_SPAWNS)
      },
      /spawnKind "wave" requires seq\/archetypeId table/
    );
  });

  it('rejects a missing spawn table for a static encounter', async () => {
    await expectParseRejects(
      {
        'sandbox-with-combat.md': (source) => removeExact(source, SANDBOX_STATIC_SPAWNS)
      },
      /spawnKind "static" requires seq\/archetypeId table/
    );
  });

  it('rejects an encounter background id that is not declared in the session table', async () => {
    await expectParseRejects(
      {
        'campaign.md': (source) =>
          replaceExact(source, '| backgroundId | set-1 |', '| backgroundId | set-missing |')
      },
      /unknown backgroundId "set-missing"/
    );
  });

  it('rejects a session background image cell without an inline image', async () => {
    await expectParseRejects(
      {
        'campaign.md': (source) =>
          replaceExact(
            source,
            '| set-1 | ![Set 1](../../public/images/bg/bg-01.jpg) |',
            '| set-1 | /images/bg/bg-01.jpg |'
          )
      },
      /expected inline image/
    );
  });

  it('rejects duplicate preset ids', () => {
    expect(() =>
      validateUniqueSessionPresetIds([
        { presetId: 'training', sourcePath: 'content/sessions/training.md' },
        { presetId: 'training', sourcePath: 'content/sessions/training-copy.md' }
      ])
    ).toThrow(/duplicate session presetId "training" first defined in content\/sessions\/training.md/);
  });

  it('fails check mode when changed markdown drifts from the generated target', async () => {
    const fixture = await copySessionsFixture();
    const targetPath = join(fixture.directory, 'sessions.generated.ts');
    const baselineGenerated = renderSessionContent(await parseSessionsArea(fixture.sourceDirectory));
    await writeFile(targetPath, baselineGenerated, 'utf8');
    const campaignPath = join(fixture.sourceDirectory, 'campaign.md');
    await writeFile(
      campaignPath,
      replaceExact(
        await readFile(campaignPath, 'utf8'),
        '| spawnIntervalMs | 1000 |',
        '| spawnIntervalMs | 400 |'
      ),
      'utf8'
    );

    const area = makeArea('sessions-drift', async () => [
      {
        path: targetPath,
        contents: renderSessionContent(await parseSessionsArea(fixture.sourceDirectory))
      }
    ]);

    await expect(runContentBuild('check', [area])).rejects.toThrow(/spawnIntervalMs: 400/);
    await expect(readFile(targetPath, 'utf8')).resolves.toBe(baselineGenerated);
  });
});

async function expectParseRejects(
  mutations: SessionMutations,
  pattern: RegExp
): Promise<void> {
  const fixture = await copySessionsFixture(mutations);

  await expect(parseSessionsArea(fixture.sourceDirectory)).rejects.toThrow(pattern);
}

async function copySessionsFixture(
  mutations: SessionMutations = {}
): Promise<Readonly<{ directory: string; sourceDirectory: string }>> {
  const directory = await mkdtemp(join(tmpdir(), 'content-build-sessions-'));
  const sourceDirectory = join(directory, 'sessions');
  await mkdir(sourceDirectory);

  for (const file of SESSION_SOURCE_FILES) {
    const source = await readFile(join('content/sessions', file), 'utf8');
    await writeFile(join(sourceDirectory, file), (mutations[file] ?? identity)(source), 'utf8');
  }

  return { directory, sourceDirectory };
}

function makeArea(name: string, render: ContentArea['render']): ContentArea {
  return { name, render };
}

function replaceExact(source: string, search: string, replacement: string): string {
  if (!source.includes(search)) {
    throw new Error(`test fixture is missing "${search}"`);
  }
  return source.replace(search, replacement);
}

function removeExact(source: string, search: string): string {
  return replaceExact(source, search, '');
}

function identity(value: string): string {
  return value;
}

const TRAINING_WAVE_1_SPAWNS = `| seq | archetypeId |
|---:|---|
| 1 | slime-one-eye |
| 2 | slime-one-eye |
| 3 | slime-shell |
| 4 | slime-one-eye |
| 5 | slime-one-eye |
| 6 | slime-shell |
`;

const SANDBOX_STATIC_SPAWNS = `| seq | archetypeId | x | y |
|---:|---|---:|---:|
| 1 | slime-bug | 5 | 0 |
`;
