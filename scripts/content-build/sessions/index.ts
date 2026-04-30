import { parseSessionsArea } from './parse';
import { renderPublicArenaContent, renderSessionContent } from './renderContent';

import type { GeneratedFile } from '../util/atomicWrite';

const SOURCE_DIRECTORY = 'content/sessions';
const CONTENT_TARGET_PATH = 'src/shared/content/sessions.generated.ts';
const PUBLIC_ARENA_TARGET_PATH = 'src/shared/content/publicArena.generated.ts';

export const SESSIONS_AREA = {
  name: 'sessions',
  async render(): Promise<ReadonlyArray<GeneratedFile>> {
    const sessionsArea = await parseSessionsArea(SOURCE_DIRECTORY);
    return [
      {
        path: CONTENT_TARGET_PATH,
        contents: renderSessionContent(sessionsArea)
      },
      {
        path: PUBLIC_ARENA_TARGET_PATH,
        contents: renderPublicArenaContent(sessionsArea)
      }
    ];
  }
};
