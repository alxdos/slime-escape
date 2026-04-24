import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PX_PER_WU } from '../../src/shared/sprite/spriteScale';

import { parseBossesArea, type ParsedBossesArea } from './bosses/parse';
import { renderBossAudio } from './bosses/renderAudio';
import { renderBossContent } from './bosses/renderContent';
import { renderBossVisuals } from './bosses/renderVisuals';
import { parseDropsArea, type ParsedDropsArea } from './drops/parse';
import { renderDropContent } from './drops/renderContent';
import { renderDropVisuals } from './drops/renderVisuals';
import { runContentBuild, type ContentArea } from './index';
import { parseWeaponsArea, type ParsedWeaponsArea } from './weapons/parse';
import { renderWeaponAudio } from './weapons/renderAudio';
import { renderWeaponContent } from './weapons/renderContent';
import { renderProjectileVisuals } from './weapons/renderVisuals';

describe('content-build archetype areas', () => {
  it('renders committed weapons markdown to committed generated files', async () => {
    const area = await parseWeaponsArea('content/weapons.md');

    await expect(readFile('src/shared/content/weapons.generated.ts', 'utf8')).resolves.toBe(
      renderWeaponContent(area)
    );
    await expect(readFile('src/main/audio/weaponAudio.generated.ts', 'utf8')).resolves.toBe(
      renderWeaponAudio(area)
    );
    await expect(readFile('src/main/render/projectileVisuals.generated.ts', 'utf8')).resolves.toBe(
      renderProjectileVisuals(area)
    );
  });

  it('renders committed drops markdown to committed generated files', async () => {
    const area = await parseDropsArea('content/drops.md');

    await expect(readFile('src/shared/content/drops.generated.ts', 'utf8')).resolves.toBe(
      renderDropContent(area)
    );
    await expect(readFile('src/main/render/dropVisuals.generated.ts', 'utf8')).resolves.toBe(
      renderDropVisuals(area)
    );
  });

  it('derives projectile and drop gameplay sizes from sprite PNG metrics, independent of arena size', async () => {
    const weaponsArea = await parseWeaponsArea('content/weapons.md');
    const dropsArea = await parseDropsArea('content/drops.md');

    for (const weapon of weaponsArea.weapons) {
      expect(weapon.projectile.size).toEqual(weapon.projectileSpriteVisual.worldSize);
      expect(deriveWorldSize(weapon.projectileSpriteVisual.sourceSizePx, { width: 16, height: 9 })).toEqual(
        weapon.projectile.size
      );
      expect(deriveWorldSize(weapon.projectileSpriteVisual.sourceSizePx, { width: 64, height: 36 })).toEqual(
        weapon.projectile.size
      );
    }

    for (const drop of dropsArea.drops) {
      const expectedRadius =
        Math.min(drop.spriteVisual.worldSize.width, drop.spriteVisual.worldSize.height) / 2;
      expect(drop.radius).toBe(expectedRadius);
      expect(deriveDropRadius(drop.spriteVisual.sourceSizePx, { width: 16, height: 9 })).toBe(
        expectedRadius
      );
      expect(deriveDropRadius(drop.spriteVisual.sourceSizePx, { width: 64, height: 36 })).toBe(
        expectedRadius
      );
    }
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
      mutate: (source) => replaceExact(source, '| heal-orb | 8000 |', '| heal-orb | |'),
      parse: parseDropsArea,
      render: renderDropContent,
      pattern: /column "ttlMs"/
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
        replaceExact(source, '| heal-orb | 8000 |', '| heal-orb | 8000 |\n| coin | 5000 |'),
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

  it('rejects weapon projectile visuals without the required inline H2 image', async () => {
    await expectParseRejects({
      sourcePath: 'content/weapons.md',
      mutate: (source) =>
        replaceExact(source, '![Pistol projectile](../public/assets/projectiles/pistol.png)\n\n', ''),
      parse: parseWeaponsArea,
      pattern: /expected !\[.*\]\(/
    });
  });

  it('rejects manual weapon sprite fields in definition tables', async () => {
    await expectParseRejects({
      sourcePath: 'content/weapons.md',
      mutate: (source) =>
        replaceExact(
          source,
          '| displayName | Pistol |',
          '| displayName | Pistol |\n| image | ../public/assets/projectiles/pistol.png |'
        ),
      parse: parseWeaponsArea,
      pattern: /sprite fields are derived from the inline image/
    });
  });

  it('rejects manual weapon sprite columns in balance tables', async () => {
    await expectParseRejects({
      sourcePath: 'content/weapons.md',
      mutate: (source) =>
        replaceExact(
          source,
          '| id | cooldownMs |\n|---|---:|',
          '| id | cooldownMs | image |\n|---|---:|---|'
        ),
      parse: parseWeaponsArea,
      pattern: /sprite fields are derived from the inline image/
    });
  });

  it('rejects drop visuals without the required inline H2 image', async () => {
    await expectParseRejects({
      sourcePath: 'content/drops.md',
      mutate: (source) => replaceExact(source, '![Heal orb](../public/assets/drops/heal-orb.png)\n\n', ''),
      parse: parseDropsArea,
      pattern: /expected !\[.*\]\(/
    });
  });

  it('rejects manual drop sprite fields in definition tables', async () => {
    await expectParseRejects({
      sourcePath: 'content/drops.md',
      mutate: (source) =>
        replaceExact(
          source,
          '| displayName | Heal Orb |',
          '| displayName | Heal Orb |\n| radius | 0.25 |'
        ),
      parse: parseDropsArea,
      pattern: /sprite fields are derived from the inline image/
    });
  });

  it('rejects manual drop sprite columns in balance tables', async () => {
    await expectParseRejects({
      sourcePath: 'content/drops.md',
      mutate: (source) =>
        replaceExact(
          source,
          '| id | ttlMs |\n|---|---:|',
          '| id | ttlMs | image |\n|---|---:|---|'
        ),
      parse: parseDropsArea,
      pattern: /sprite fields are derived from the inline image/
    });
  });

  it('rejects negative weapon force values', async () => {
    await expectParseRejects({
      sourcePath: 'content/weapons.md',
      mutate: (source) => replaceExact(source, '| pistol | 1 | 5 | 0 |', '| pistol | 1 | -1 | 0 |'),
      parse: parseWeaponsArea,
      pattern: /knockbackImpulse.*expected >= 0/
    });
  });

  it('rejects non-positive projectile motion values', async () => {
    await expectParseRejects({
      sourcePath: 'content/weapons.md',
      mutate: (source) =>
        replaceExact(
          source,
          '| grenade-launcher | arc | 7 | 6 | 700 |',
          '| grenade-launcher | arc | 7 | 6 | 0 |'
        ),
      parse: parseWeaponsArea,
      pattern: /flightMs.*expected > 0/
    });
  });

  it('rejects weapon fragments that reference unknown weapon ids', async () => {
    await expectParseRejects({
      sourcePath: 'content/weapons.md',
      mutate: (source) =>
        replaceExact(
          source,
          '| bomb-placer | none | 0 | 0 |',
          '| bomb-placer | missing-weapon | 4 | 1 |'
        ),
      parse: parseWeaponsArea,
      pattern: /fragmentWeaponId.*unknown weapon id "missing-weapon"/
    });
  });

  it('rejects weapon fragments on weapons without an explosion spec', async () => {
    await expectParseRejects({
      sourcePath: 'content/weapons.md',
      mutate: (source) =>
        replaceExact(
          source,
          '## Explosion Fragments\n\n| id | fragmentWeaponId | count | spreadRadians |\n|---|---|---:|---:|\n| pistol | none | 0 | 0 |\n| shotgun | none | 0 | 0 |\n| smg | none | 0 | 0 |\n| sniper | none | 0 | 0 |\n| laser | none | 0 | 0 |\n| rock-thrower | none | 0 | 0 |',
          '## Explosion Fragments\n\n| id | fragmentWeaponId | count | spreadRadians |\n|---|---|---:|---:|\n| pistol | none | 0 | 0 |\n| shotgun | none | 0 | 0 |\n| smg | none | 0 | 0 |\n| sniper | none | 0 | 0 |\n| laser | none | 0 | 0 |\n| rock-thrower | pistol | 2 | 1 |'
        ),
      parse: parseWeaponsArea,
      pattern: /fragment requires a non-none explosion/
    });
  });

  it('rejects drop fragment modifiers that reference unknown weapon ids', async () => {
    await expectParseRejects({
      sourcePath: 'content/drops.md',
      mutate: (source) =>
        replaceExact(
          source,
          '| fragment | fragmentExplosion | 6 | pistol | 6.2831853072 |',
          '| fragment | fragmentExplosion | 6 | railgun | 6.2831853072 |'
        ),
      parse: parseDropsArea,
      pattern: /fragmentWeaponId.*unknown weapon id "railgun"/
    });
  });

  it('rejects weapon modifier drops with an unsupported target', async () => {
    await expectParseRejects({
      sourcePath: 'content/drops.md',
      mutate: (source) =>
        replaceExact(
          source,
          '| size-up | addWeaponModifier | selectedWeapon | none | none |',
          '| size-up | addWeaponModifier | allWeapons | none | none |'
        ),
      parse: parseDropsArea,
      pattern: /target.*expected selectedWeapon/
    });
  });

  it('rejects non-positive weapon modifier multipliers', async () => {
    await expectParseRejects({
      sourcePath: 'content/drops.md',
      mutate: (source) =>
        replaceExact(
          source,
          '| size-up | projectileSizeMultiplier | 1.5 | none | 0 |',
          '| size-up | projectileSizeMultiplier | 0 | none | 0 |'
        ),
      parse: parseDropsArea,
      pattern: /value.*expected > 0/
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

  it('rejects bosses without required inline image nodes', async () => {
    await expectParseRejects({
      sourcePath: 'content/bosses.md',
      mutate: (source) =>
        replaceExact(source, '![Gargoyle Slime](../public/assets/boss-01.png)\n\n', ''),
      parse: parseBossesArea,
      pattern: /expected !\[…\]/
    });
  });

  it('rejects legacy boss Visual balance groups', async () => {
    await expectParseRejects({
      sourcePath: 'content/bosses.md',
      mutate: (source) =>
        `${source}\n\n## Visual\n\n| id | image |\n|---|---|\n| boss-gargoyle | /assets/boss-01.png |\n`,
      parse: parseBossesArea,
      pattern: /replaced by inline image/
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

function deriveWorldSize(
  sourceSizePx: Readonly<{ width: number; height: number }>,
  _arena: Readonly<{ width: number; height: number }>
): Readonly<{ width: number; height: number }> {
  return {
    width: sourceSizePx.width / PX_PER_WU,
    height: sourceSizePx.height / PX_PER_WU
  };
}

function deriveDropRadius(
  sourceSizePx: Readonly<{ width: number; height: number }>,
  arena: Readonly<{ width: number; height: number }>
): number {
  const worldSize = deriveWorldSize(sourceSizePx, arena);
  return Math.min(worldSize.width, worldSize.height) / 2;
}

function replaceExact(source: string, search: string, replacement: string): string {
  if (!source.includes(search)) {
    throw new Error(`test fixture is missing "${search}"`);
  }
  return source.replace(search, replacement);
}
