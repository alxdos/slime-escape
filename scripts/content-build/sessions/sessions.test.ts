import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { runContentBuild, type ContentArea } from '../index';
import { parseSessionsArea, validateUniqueSessionPresetIds } from './parse';
import { renderSessionContent } from './renderContent';

const SESSION_SOURCE_FILES = [
  'campaign-easy.md',
  'campaign-hard.md',
  'campaign-normal.md',
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
      file: 'campaign-normal.md' as const,
      mutate: (source: string) => replaceExact(source, '| arenaId | sandbox |', '| arenaId | sndbox |'),
      pattern: /section "# Session": unknown arenaId "sndbox"/
    },
    {
      name: 'playerId',
      file: 'campaign-normal.md' as const,
      mutate: (source: string) =>
        replaceExact(source, '| playerId | hero-training |', '| playerId | hero-ghost |'),
      pattern: /section "# Session": unknown playerId "hero-ghost"/
    },
    {
      name: 'loadoutWeaponIds',
      file: 'campaign-normal.md' as const,
      mutate: (source: string) =>
        replaceExact(
          source,
          '| loadoutWeaponIds | pistol, shotgun, smg, sniper, demo-hazard-grenade, demo-proximity-mine |',
          '| loadoutWeaponIds | pistol, shotgun, smg, railgun, demo-hazard-grenade, demo-proximity-mine |'
        ),
      pattern: /section "# Session": unknown loadoutWeaponIds "railgun"/
    },
    {
      name: 'bossArchetypeId',
      file: 'campaign-normal.md' as const,
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

  it('rejects selectedWeaponIndex outside the authored ordered loadout', async () => {
    await expectParseRejects(
      {
        'training.md': (source) =>
          replaceExact(source, '| selectedWeaponIndex | 0 |', '| selectedWeaponIndex | 3 |')
      },
      /selectedWeaponIndex.*expected 0\.\.2 or none/
    );
  });

  it('rejects selectedWeaponIndex when loadoutWeaponIds is none', async () => {
    await expectParseRejects(
      {
        'sandbox.md': (source) =>
          replaceExact(source, '| selectedWeaponIndex | none |', '| selectedWeaponIndex | 0 |')
      },
      /selectedWeaponIndex.*expected none when loadoutWeaponIds is none/
    );
  });

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
        'campaign-normal.md': (source) => `${source}\n| seq | archetypeId |\n|---:|---|\n| 1 | slime-one-eye |\n`
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

  it('rejects a spawn override table on an empty encounter', async () => {
    await expectParseRejects(
      {
        'sandbox.md': (source) => `${source}\n${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | heal-orb | none | none | none | none | none |\n`
      },
      /spawnKind "empty" forbids spawn override table/
    );
  });

  it('rejects a spawn override that references a missing seq', async () => {
    await expectParseRejects(
      {
        'training.md': (source) =>
          addTrainingWave1OverrideTable(
            source,
            `${SPAWN_OVERRIDE_TABLE_HEADER}| 99 | heal-orb | none | none | none | none | none |\n`
          )
      },
      /override references missing seq "99"/
    );
  });

  it('rejects duplicate seq values in a spawn override table', async () => {
    await expectParseRejects(
      {
        'training.md': (source) =>
          addTrainingWave1OverrideTable(
            source,
            `${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | heal-orb | none | none | none | none | none |\n| 1 | magnet | none | none | none | none | none |\n`
          )
      },
      /duplicate seq "1"/
    );
  });

  it('rejects an unknown spawn override field name', async () => {
    await expectParseRejects(
      {
        'training.md': (source) =>
          addTrainingWave1OverrideTable(
            source,
            `| seq | bonusDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |\n|---:|---|---|---|---:|---|---|\n| 1 | heal-orb | none | none | none | none | none |\n`
          )
      },
      /unknown spawn override field "bonusDrops"/
    );
  });

  it('rejects unknown drop ids in guaranteed spawn override drops', async () => {
    await expectParseRejects(
      {
        'training.md': (source) =>
          addTrainingWave1OverrideTable(
            source,
            `${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | missing-drop | none | none | none | none | none |\n`
          )
      },
      /unknown guaranteedDrops "missing-drop"/
    );
  });

  it('rejects unknown drop ids in spawn override drop tables', async () => {
    await expectParseRejects(
      {
        'training.md': (source) =>
          addTrainingWave1OverrideTable(
            source,
            `${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | none | missing-drop:0.2 | none | none | none | none |\n`
          )
      },
      /unknown dropTable "missing-drop"/
    );
  });

  it('keeps dropTable empty distinct from none in spawn overrides', async () => {
    const fixture = await copySessionsFixture({
      'training.md': (source) =>
        addTrainingWave1OverrideTable(
          source,
          `${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | none | empty | none | none | none | none |\n| 2 | heal-orb | none | none | none | none | none |\n| 3 | none | none | none | none | none | none |\n`
        )
    });

    const area = await parseSessionsArea(fixture.sourceDirectory);
    const trainingPreset = area.presets.find((preset) => preset.presetId === 'training');
    const encounter = trainingPreset?.encounters.find(({ id }) => id === 'training-wave-1');

    expect(encounter?.spawnPlan.kind).toBe('wave');
    if (encounter?.spawnPlan.kind !== 'wave') {
      throw new Error('training-wave-1 fixture must stay a wave encounter');
    }
    expect(encounter.spawnPlan.spawns[0]?.override).toEqual({ dropTable: [] });
    expect(encounter.spawnPlan.spawns[1]?.override).toEqual({
      guaranteedDrops: [{ id: 'heal-orb', constName: 'HEAL_ORB' }]
    });
    expect(encounter.spawnPlan.spawns[2]?.override).toBeUndefined();
  });

  it('rejects empty as a guaranteed spawn override drop list', async () => {
    await expectParseRejects(
      {
        'training.md': (source) =>
          addTrainingWave1OverrideTable(
            source,
            `${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | empty | none | none | none | none | none |\n`
          )
      },
      /guaranteedDrops.*expected comma-separated drop ids or none/
    );
  });

  it('rejects partially authored spawn override retaliation', async () => {
    await expectParseRejects(
      {
        'training.md': (source) =>
          addTrainingWave1OverrideTable(
            source,
            `${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | none | none | true | none | none | none |\n`
          )
      },
      /retaliationEnabled and retaliationDurationMs must be set together/
    );
  });

  it('parses spawn override loadout with nullable selected weapon index', async () => {
    const fixture = await copySessionsFixture({
      'training.md': (source) =>
        addTrainingWave1OverrideTable(
          source,
          `${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | none | none | none | none | pistol, smg | null |\n`
        )
    });

    const area = await parseSessionsArea(fixture.sourceDirectory);
    const trainingPreset = area.presets.find((preset) => preset.presetId === 'training');
    const encounter = trainingPreset?.encounters.find(({ id }) => id === 'training-wave-1');

    expect(encounter?.spawnPlan.kind).toBe('wave');
    if (encounter?.spawnPlan.kind !== 'wave') {
      throw new Error('training-wave-1 fixture must stay a wave encounter');
    }
    expect(encounter.spawnPlan.spawns[0]?.override).toEqual({
      loadout: {
        weapons: [
          { id: 'pistol', constName: 'PISTOL' },
          { id: 'smg', constName: 'SMG' }
        ],
        selectedIndex: null
      }
    });
  });

  it('renders spawn override loadout into generated session content', async () => {
    const fixture = await copySessionsFixture({
      'training.md': (source) =>
        addTrainingWave1OverrideTable(
          source,
          `${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | none | none | none | none | pistol, smg | 1 |\n`
        )
    });

    const rendered = renderSessionContent(await parseSessionsArea(fixture.sourceDirectory));

    expect(rendered).toContain(
      'override: { loadout: { weapons: [PISTOL.id, SMG.id], selectedIndex: 1 } }'
    );
  });

  it('rejects unknown weapon ids in spawn override loadouts', async () => {
    await expectParseRejects(
      {
        'training.md': (source) =>
          addTrainingWave1OverrideTable(
            source,
            `${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | none | none | none | none | railgun | 0 |\n`
          )
      },
      /unknown loadoutWeaponIds "railgun"/
    );
  });

  it('rejects selectedWeaponIndex outside spawn override loadout', async () => {
    await expectParseRejects(
      {
        'training.md': (source) =>
          addTrainingWave1OverrideTable(
            source,
            `${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | none | none | none | none | pistol, smg | 2 |\n`
          )
      },
      /selectedWeaponIndex.*expected 0\.\.1 or null/
    );
  });

  it('rejects partially authored spawn override loadout', async () => {
    await expectParseRejects(
      {
        'training.md': (source) =>
          addTrainingWave1OverrideTable(
            source,
            `${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | none | none | none | none | pistol | none |\n`
          )
      },
      /loadoutWeaponIds and selectedWeaponIndex must be set together/
    );
  });

  it('warns on spawn override drop table chances outside [0, 1]', async () => {
    await expectParseWarns(
      {
        'training.md': (source) =>
          addTrainingWave1OverrideTable(
            source,
            `${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | none | heal-orb:1.2 | none | none | none | none |\n`
          )
      },
      'spawn override drop table entry chance out of [0, 1] per design/spawn-overrides.md'
    );
  });

  it('warns on spawn override drop table chance sums above 1', async () => {
    await expectParseWarns(
      {
        'training.md': (source) =>
          addTrainingWave1OverrideTable(
            source,
            `${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | none | heal-orb:0.6, magnet:0.5 | none | none | none | none |\n`
          )
      },
      'spawn override drop table chances sum exceeds 1 per design/spawn-overrides.md'
    );
  });

  it('warns on enabled spawn override retaliation without positive duration', async () => {
    await expectParseWarns(
      {
        'training.md': (source) =>
          addTrainingWave1OverrideTable(
            source,
            `${SPAWN_OVERRIDE_TABLE_HEADER}| 1 | none | none | true | 0 | none | none |\n`
          )
      },
      'enabled spawn override retaliation duration must be positive per design/spawn-overrides.md'
    );
  });

  it('rejects an encounter background id that is not declared in the session table', async () => {
    await expectParseRejects(
      {
        'campaign-normal.md': (source) =>
          replaceExact(source, '| backgroundId | set-1 |', '| backgroundId | set-missing |')
      },
      /unknown backgroundId "set-missing"/
    );
  });

  it('rejects a session background image cell without an inline image', async () => {
    await expectParseRejects(
      {
        'campaign-normal.md': (source) =>
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
    const campaignPath = join(fixture.sourceDirectory, 'campaign-normal.md');
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

async function expectParseWarns(
  mutations: SessionMutations,
  message: string
): Promise<void> {
  const fixture = await copySessionsFixture(mutations);
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  try {
    await expect(parseSessionsArea(fixture.sourceDirectory)).resolves.toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith('[unknown]', message, expect.any(Object));
  } finally {
    warnSpy.mockRestore();
  }
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

function addTrainingWave1OverrideTable(source: string, table: string): string {
  return replaceExact(source, TRAINING_WAVE_1_SPAWNS, `${TRAINING_WAVE_1_SPAWNS}\n${table}`);
}

function identity(value: string): string {
  return value;
}

const SPAWN_OVERRIDE_TABLE_HEADER = `| seq | guaranteedDrops | dropTable | retaliationEnabled | retaliationDurationMs | loadoutWeaponIds | selectedWeaponIndex |
|---:|---|---|---|---:|---|---|
`;

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
