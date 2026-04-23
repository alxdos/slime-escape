import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseBossesArea, type ParsedBossesArea } from './bosses/parse';
import { renderBossAudio } from './bosses/renderAudio';
import { renderBossContent } from './bosses/renderContent';
import { renderBossVisuals } from './bosses/renderVisuals';
import { parseDropsArea, type ParsedDropsArea } from './drops/parse';
import { renderDropContent } from './drops/renderContent';
import { runContentBuild, type ContentArea } from './index';
import { parseWeaponsArea, type ParsedWeaponsArea } from './weapons/parse';
import { renderWeaponAudio } from './weapons/renderAudio';
import { renderWeaponContent } from './weapons/renderContent';

describe('content-build archetype areas', () => {
  it('renders committed weapons markdown to committed generated files', async () => {
    const area = await parseWeaponsArea('content/weapons.md');

    await expect(readFile('src/shared/content/weapons.generated.ts', 'utf8')).resolves.toBe(
      renderWeaponContent(area)
    );
    await expect(readFile('src/main/audio/weaponAudio.generated.ts', 'utf8')).resolves.toBe(
      renderWeaponAudio(area)
    );
  });

  it('renders committed drops markdown to committed generated files', async () => {
    const area = await parseDropsArea('content/drops.md');

    await expect(readFile('src/shared/content/drops.generated.ts', 'utf8')).resolves.toBe(
      renderDropContent(area)
    );
  });

  it('renders committed bosses markdown to committed generated files', async () => {
    const area = await parseBossesArea('content/bosses.md');

    await expect(readFile('src/shared/content/bosses.generated.ts', 'utf8')).resolves.toBe(
      renderBossContent(area)
    );
    await expect(readFile('src/main/audio/bossAudio.generated.ts', 'utf8')).resolves.toBe(
      renderBossAudio(area)
    );
  });

  it('rejects missing required cells before modifying targets', async () => {
    await expectAreaRejectsBeforeWriting<ParsedWeaponsArea>({
      name: 'weapons-missing-cell',
      sourcePath: 'content/weapons.md',
      targetName: 'weapons.generated.ts',
      mutate: (source) => replaceExact(source, '| pistol | 250 |', '| pistol | |'),
      parse: parseWeaponsArea,
      render: renderWeaponContent,
      pattern: /column "cooldownMs"/
    });

    await expectAreaRejectsBeforeWriting<ParsedDropsArea>({
      name: 'drops-missing-cell',
      sourcePath: 'content/drops.md',
      targetName: 'drops.generated.ts',
      mutate: (source) => replaceExact(source, '| heal-orb | 0.35 | 8000 |', '| heal-orb | | 8000 |'),
      parse: parseDropsArea,
      render: renderDropContent,
      pattern: /column "radius"/
    });

    await expectAreaRejectsBeforeWriting<ParsedBossesArea>({
      name: 'bosses-missing-cell',
      sourcePath: 'content/bosses.md',
      targetName: 'bosses.generated.ts',
      mutate: (source) =>
        replaceExact(source, '| boss-gargoyle | 1.15 | 35 |', '| boss-gargoyle | | 35 |'),
      parse: parseBossesArea,
      render: renderBossContent,
      pattern: /column "radius"/
    });
  });

  it('rejects balance rows that reference unknown ids', async () => {
    await expectParseRejects({
      sourcePath: 'content/weapons.md',
      mutate: (source) =>
        replaceExact(source, '| pistol | 250 |', '| pistol | 250 |\n| ghost-gun | 100 |'),
      parse: parseWeaponsArea,
      pattern: /unknown weapon id "ghost-gun"/
    });

    await expectParseRejects({
      sourcePath: 'content/drops.md',
      mutate: (source) =>
        replaceExact(source, '| heal-orb | 0.35 | 8000 |', '| heal-orb | 0.35 | 8000 |\n| coin | 0.2 | 5000 |'),
      parse: parseDropsArea,
      pattern: /unknown drop id "coin"/
    });

    await expectParseRejects({
      sourcePath: 'content/bosses.md',
      mutate: (source) =>
        replaceExact(
          source,
          '| boss-gargoyle | 1.15 | 35 |',
          '| boss-gargoyle | 1.15 | 35 |\n| slime-queen | 1 | 20 |'
        ),
      parse: parseBossesArea,
      pattern: /unknown boss id "slime-queen"/
    });
  });

  it('rejects boss phases that reference unknown attack keys', async () => {
    await expectParseRejects({
      sourcePath: 'content/bosses.md',
      mutate: (source) => replaceExact(source, 'coneBurst, spawnAdds', 'coneBurst, missingAttack'),
      parse: parseBossesArea,
      pattern: /unknown attackKey "missingAttack"/
    });
  });

  it('rejects weapon audio without the required inline H2 link', async () => {
    await expectParseRejects({
      sourcePath: 'content/weapons.md',
      mutate: (source) => replaceExact(source, '[weapons/pistol](../public/sfx/weapons/pistol.mp3)\n\n', ''),
      parse: parseWeaponsArea,
      pattern: /expected \[<sample-id>\]/
    });
  });

  it('rejects legacy weapon Sound balance groups', async () => {
    await expectParseRejects({
      sourcePath: 'content/weapons.md',
      mutate: (source) =>
        `${source}\n\n## Sound\n\n| id | fire |\n|---|---|\n| pistol | weapons/pistol |\n`,
      parse: parseWeaponsArea,
      pattern: /replaced by inline audio-link/
    });
  });

  it('renders boss visual specs from PNG image paths', async () => {
    const area = await parseBossesArea('content/bosses.md');
    const visuals = renderBossVisuals(area);

    expect(visuals).toContain("export const BOSS_SCRAP_KING_VISUAL: SpriteVisualSpec");
    expect(visuals).toContain("image: '/assets/boss-03.png'");
    expect(visuals).toContain('sourceSizePx: { width:');
    expect(visuals).toContain('BOSS_VISUAL_SPECS');
  });

  it('fails check mode when a new area generated target has drifted', async () => {
    const area = await parseWeaponsArea('content/weapons.md');
    const directory = await mkdtemp(join(tmpdir(), 'content-build-archetype-drift-'));
    const targetPath = join(directory, 'weapons.generated.ts');
    await writeFile(targetPath, 'stale weapon target', 'utf8');

    const driftArea = makeArea('weapons-drift', async () => [
      { path: targetPath, contents: renderWeaponContent(area) }
    ]);

    await expect(runContentBuild('check', [driftArea])).rejects.toThrow(/stale weapon target/);
    await expect(readFile(targetPath, 'utf8')).resolves.toBe('stale weapon target');
  });
});

async function expectAreaRejectsBeforeWriting<T>(
  options: Readonly<{
    name: string;
    sourcePath: string;
    targetName: string;
    mutate(source: string): string;
    parse(sourcePath: string): Promise<T>;
    render(area: T): string;
    pattern: RegExp;
  }>
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), `content-build-${options.name}-`));
  const sourcePath = join(directory, options.sourcePath.split('/').at(-1) ?? 'source.md');
  const targetPath = join(directory, options.targetName);
  await writeFile(sourcePath, options.mutate(await readFile(options.sourcePath, 'utf8')), 'utf8');
  await writeFile(targetPath, 'old target', 'utf8');

  const area = makeArea(options.name, async () => {
    const parsed = await options.parse(sourcePath);
    return [{ path: targetPath, contents: options.render(parsed) }];
  });

  await expect(runContentBuild('build', [area])).rejects.toThrow(options.pattern);
  await expect(readFile(targetPath, 'utf8')).resolves.toBe('old target');
}

async function expectParseRejects<T>(
  options: Readonly<{
    sourcePath: string;
    mutate(source: string): string;
    parse(sourcePath: string): Promise<T>;
    pattern: RegExp;
  }>
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'content-build-archetype-parse-'));
  const sourcePath = join(directory, options.sourcePath.split('/').at(-1) ?? 'source.md');
  await writeFile(sourcePath, options.mutate(await readFile(options.sourcePath, 'utf8')), 'utf8');

  await expect(options.parse(sourcePath)).rejects.toThrow(options.pattern);
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
