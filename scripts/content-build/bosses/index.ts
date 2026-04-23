import { parseBossesArea } from './parse';
import { renderBossAudio } from './renderAudio';
import { renderBossContent } from './renderContent';
import { renderBossVisuals } from './renderVisuals';

import type { GeneratedFile } from '../util/atomicWrite';

const SOURCE_PATH = 'content/bosses.md';
const CONTENT_TARGET_PATH = 'src/shared/content/bosses.generated.ts';
const AUDIO_TARGET_PATH = 'src/main/audio/bossAudio.generated.ts';
const VISUAL_TARGET_PATH = 'src/main/render/bossVisuals.generated.ts';

export const BOSSES_AREA = {
  name: 'bosses',
  async render(): Promise<ReadonlyArray<GeneratedFile>> {
    const bossesArea = await parseBossesArea(SOURCE_PATH);
    return [
      {
        path: CONTENT_TARGET_PATH,
        contents: renderBossContent(bossesArea)
      },
      {
        path: AUDIO_TARGET_PATH,
        contents: renderBossAudio(bossesArea)
      },
      {
        path: VISUAL_TARGET_PATH,
        contents: renderBossVisuals(bossesArea)
      }
    ];
  }
};
