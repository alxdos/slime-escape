import { parseDropsArea } from './parse';
import { renderDropContent } from './renderContent';

import type { GeneratedFile } from '../util/atomicWrite';

const SOURCE_PATH = 'content/drops.md';
const CONTENT_TARGET_PATH = 'src/shared/content/drops.generated.ts';

export const DROPS_AREA = {
  name: 'drops',
  async render(): Promise<ReadonlyArray<GeneratedFile>> {
    const dropsArea = await parseDropsArea(SOURCE_PATH);
    return [
      {
        path: CONTENT_TARGET_PATH,
        contents: renderDropContent(dropsArea)
      }
    ];
  }
};
