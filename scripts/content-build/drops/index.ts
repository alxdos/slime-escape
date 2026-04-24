import { parseDropsArea, type ParsedDropsArea } from './parse';
import { renderDropContent } from './renderContent';
import { renderDropVisuals } from './renderVisuals';

import type { GeneratedFile } from '../util/atomicWrite';
import { ContentBuildError } from '../util/require';

const SOURCE_PATH = 'content/drops.md';
const CONTENT_TARGET_PATH = 'src/shared/content/drops.generated.ts';
const DROP_VISUALS_TARGET_PATH = 'src/main/render/dropVisuals.generated.ts';

export const DROPS_AREA = {
  name: 'drops',
  async render(): Promise<ReadonlyArray<GeneratedFile>> {
    const dropsArea = await parseDropsArea(SOURCE_PATH);
    assertDropVisualRadiusConsistency(dropsArea);
    return [
      {
        path: CONTENT_TARGET_PATH,
        contents: renderDropContent(dropsArea)
      },
      {
        path: DROP_VISUALS_TARGET_PATH,
        contents: renderDropVisuals(dropsArea)
      }
    ];
  }
};

function assertDropVisualRadiusConsistency(area: ParsedDropsArea): void {
  for (const drop of area.drops) {
    const worldSize = drop.spriteVisual.worldSize;
    const expectedRadius = Math.min(worldSize.width, worldSize.height) / 2;
    if (!nearlyEqual(drop.radius, expectedRadius)) {
      throw new ContentBuildError(
        `${area.sourcePath}: drop "${drop.id}" radius must derive from drop visual worldSize`
      );
    }
  }
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9;
}
