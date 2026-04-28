import { parsePetsArea } from './parse';
import { renderPetContent } from './renderContent';
import { renderPetVisuals } from './renderVisuals';

import type { GeneratedFile } from '../util/atomicWrite';

const SOURCE_PATH = 'content/pets.md';
const CONTENT_TARGET_PATH = 'src/shared/content/pets.generated.ts';
const VISUAL_TARGET_PATH = 'src/main/render/petVisuals.generated.ts';

export const PETS_AREA = {
  name: 'pets',
  async render(): Promise<ReadonlyArray<GeneratedFile>> {
    const petsArea = await parsePetsArea(SOURCE_PATH);
    return [
      {
        path: CONTENT_TARGET_PATH,
        contents: renderPetContent(petsArea)
      },
      {
        path: VISUAL_TARGET_PATH,
        contents: renderPetVisuals(petsArea)
      }
    ];
  }
};
