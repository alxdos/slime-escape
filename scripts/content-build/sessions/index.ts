import { parseSessionsArea } from './parse';
import { renderSessionContent } from './renderContent';

import type { GeneratedFile } from '../util/atomicWrite';

const SOURCE_DIRECTORY = 'content/sessions';
const CONTENT_TARGET_PATH = 'src/shared/content/sessions.generated.ts';

export const SESSIONS_AREA = {
  name: 'sessions',
  async render(): Promise<ReadonlyArray<GeneratedFile>> {
    const sessionsArea = await parseSessionsArea(SOURCE_DIRECTORY);
    return [
      {
        path: CONTENT_TARGET_PATH,
        contents: renderSessionContent(sessionsArea)
      }
    ];
  }
};
