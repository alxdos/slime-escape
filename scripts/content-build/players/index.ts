import { parsePlayersArea } from './parse';
import { renderPlayerContent } from './renderContent';
import { renderPlayerVisuals } from './renderVisuals';

import type { GeneratedFile } from '../util/atomicWrite';

const SOURCE_PATH = 'content/players.md';
const CONTENT_TARGET_PATH = 'src/shared/content/players.generated.ts';
const VISUAL_TARGET_PATH = 'src/main/render/playerVisuals.generated.ts';

export const PLAYERS_AREA = {
  name: 'players',
  async render(): Promise<ReadonlyArray<GeneratedFile>> {
    const playersArea = await parsePlayersArea(SOURCE_PATH);
    return [
      {
        path: CONTENT_TARGET_PATH,
        contents: renderPlayerContent(playersArea)
      },
      {
        path: VISUAL_TARGET_PATH,
        contents: renderPlayerVisuals(playersArea)
      }
    ];
  }
};
