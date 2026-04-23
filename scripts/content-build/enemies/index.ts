import { parseEnemiesArea } from './parse';
import { renderEnemyAudio } from './renderAudio';
import { renderEnemyContent } from './renderContent';

import type { GeneratedFile } from '../util/atomicWrite';

const SOURCE_PATH = 'content/enemies.md';
const CONTENT_TARGET_PATH = 'src/shared/content/enemies.generated.ts';
const AUDIO_TARGET_PATH = 'src/main/audio/enemyAudio.generated.ts';

export const ENEMIES_AREA = {
  name: 'enemies',
  async render(): Promise<ReadonlyArray<GeneratedFile>> {
    const enemiesArea = await parseEnemiesArea(SOURCE_PATH);
    return [
      {
        path: CONTENT_TARGET_PATH,
        contents: renderEnemyContent(enemiesArea)
      },
      {
        path: AUDIO_TARGET_PATH,
        contents: renderEnemyAudio(enemiesArea)
      }
    ];
  }
};
