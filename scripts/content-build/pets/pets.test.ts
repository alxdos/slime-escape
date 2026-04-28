import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parsePetsArea } from './parse';
import { renderPetContent } from './renderContent';
import { renderPetVisuals } from './renderVisuals';

describe('content-build pets area', () => {
  it('rejects a missing pets markdown source with an explicit message', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-missing-pets-'));

    await expect(parsePetsArea(join(directory, 'pets.md'))).rejects.toThrow(/source not found/);
  });

  it('renders committed pets markdown to committed generated files', async () => {
    const area = await parsePetsArea('content/pets.md');

    await expect(readFile('src/shared/content/pets.generated.ts', 'utf8')).resolves.toBe(
      renderPetContent(area)
    );
    await expect(readFile('src/main/render/petVisuals.generated.ts', 'utf8')).resolves.toBe(
      renderPetVisuals(area)
    );
  });

  it('renders pet content, economy, and visual specs from markdown', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-pets-render-'));
    const sourcePath = join(directory, 'pets.md');
    await writeFile(sourcePath, makePetsMarkdown(), 'utf8');

    const area = await parsePetsArea(sourcePath);
    const content = renderPetContent(area);
    const visuals = renderPetVisuals(area);

    expect(content).toContain("export const PET_01: PetArchetype");
    expect(content).toContain("quality: 'green'");
    expect(content).toContain("quality: 'purple'");
    expect(content).toContain('export const PET_ECONOMY: PetEconomy');
    expect(content).toContain('green: 25');
    expect(content).toContain('purple: 75');
    expect(visuals).toContain("export const PET_01_PET_VISUAL: SpriteVisualSpec");
    expect(visuals).toContain("image: '/assets/pets/pet-01.png'");
    expect(visuals).toContain('sourceSizePx: { width:');
    expect(visuals).toContain('worldSize: { width:');
  });

  it('rejects pets without required inline image nodes', async () => {
    await expectParseRejects({
      mutate: (source) =>
        replaceExact(source, '![Sprout Buddy](../public/assets/pets/pet-01.png)\n\n', ''),
      pattern: /expected !\[…\]/
    });
  });

  it('rejects unsupported pet qualities', async () => {
    await expectParseRejects({
      mutate: (source) => replaceExact(source, '| quality | green |', '| quality | orange |'),
      pattern: /expected green or purple/
    });
  });

  it('rejects pet pools with the wrong quality count', async () => {
    await expectParseRejects({
      mutate: (source) => replaceExact(source, '| quality | green |', '| quality | purple |'),
      pattern: /expected exactly 5 green pets and 5 purple pets/
    });
  });

  it('rejects manual pet sprite fields in definition tables', async () => {
    await expectParseRejects({
      mutate: (source) =>
        replaceExact(
          source,
          '| displayName | Sprout Buddy |',
          '| displayName | Sprout Buddy |\n| image | ../public/assets/pets/pet-01.png |'
        ),
      pattern: /sprite fields are derived from the inline image/
    });
  });

  it('rejects pet economy where the green stand is not cheaper', async () => {
    await expectParseRejects({
      mutate: (source) => replaceExact(source, '| greenStandPrice | 25 |', '| greenStandPrice | 75 |'),
      pattern: /expected greenStandPrice to be lower/
    });
  });

  it('rejects non-integer pet economy values', async () => {
    await expectParseRejects({
      mutate: (source) => replaceExact(source, '| xpPerDestroyedSlime | 1 |', '| xpPerDestroyedSlime | 0.5 |'),
      pattern: /expected integer >= 0/
    });
  });
});

async function expectParseRejects(
  options: Readonly<{
    mutate(source: string): string;
    pattern: RegExp;
  }>
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'content-build-pets-parse-'));
  const sourcePath = join(directory, 'pets.md');
  await writeFile(sourcePath, options.mutate(makePetsMarkdown()), 'utf8');

  await expect(parsePetsArea(sourcePath)).rejects.toThrow(options.pattern);
}

function makePetsMarkdown(): string {
  return `# Pets

## pet-01

![Sprout Buddy](../public/assets/pets/pet-01.png)

| field | value |
|---|---|
| displayName | Sprout Buddy |
| quality | green |

## pet-02

![Clover Buddy](../public/assets/pets/pet-02.png)

| field | value |
|---|---|
| displayName | Clover Buddy |
| quality | green |

## pet-03

![Moss Buddy](../public/assets/pets/pet-03.png)

| field | value |
|---|---|
| displayName | Moss Buddy |
| quality | green |

## pet-04

![Mint Buddy](../public/assets/pets/pet-04.png)

| field | value |
|---|---|
| displayName | Mint Buddy |
| quality | green |

## pet-05

![Leaf Buddy](../public/assets/pets/pet-05.png)

| field | value |
|---|---|
| displayName | Leaf Buddy |
| quality | green |

## pet-11

![Amethyst Buddy](../public/assets/pets/pet-11.png)

| field | value |
|---|---|
| displayName | Amethyst Buddy |
| quality | purple |

## pet-12

![Star Buddy](../public/assets/pets/pet-12.png)

| field | value |
|---|---|
| displayName | Star Buddy |
| quality | purple |

## pet-13

![Dream Buddy](../public/assets/pets/pet-13.png)

| field | value |
|---|---|
| displayName | Dream Buddy |
| quality | purple |

## pet-14

![Mystic Buddy](../public/assets/pets/pet-14.png)

| field | value |
|---|---|
| displayName | Mystic Buddy |
| quality | purple |

## pet-15

![Royal Buddy](../public/assets/pets/pet-15.png)

| field | value |
|---|---|
| displayName | Royal Buddy |
| quality | purple |

# Economy

| field | value |
|---|---:|
| xpPerDestroyedSlime | 1 |
| greenStandPrice | 25 |
| purpleStandPrice | 75 |
`;
}

function replaceExact(source: string, search: string, replacement: string): string {
  if (!source.includes(search)) {
    throw new Error(`test fixture is missing "${search}"`);
  }
  return source.replace(search, replacement);
}
