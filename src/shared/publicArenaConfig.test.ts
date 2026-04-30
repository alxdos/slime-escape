import { describe, expect, it } from 'vitest';

import {
  PUBLIC_ARENA_PRESENTATION_CONFIG,
  PUBLIC_ARENA_WORLD_BOUNDS,
  worldBoundsFromArena
} from './publicArenaConfig';

describe('public arena config', () => {
  it('keeps the first online arena config narrow and portal-background based', () => {
    expect(Object.keys(PUBLIC_ARENA_PRESENTATION_CONFIG)).toEqual([
      'arena',
      'backgrounds',
      'activeBackgroundId'
    ]);
    expect(PUBLIC_ARENA_PRESENTATION_CONFIG).toEqual({
      arena: { width: 40, height: 40 },
      backgrounds: [{ id: 'portal', imageUrl: '/images/bg/bg-01.jpg' }],
      activeBackgroundId: 'portal'
    });
  });

  it('derives centered world bounds from the shared arena dimensions', () => {
    expect(PUBLIC_ARENA_WORLD_BOUNDS).toEqual({
      width: 40,
      height: 40,
      minX: -20,
      maxX: 20,
      minY: -20,
      maxY: 20
    });
    expect(worldBoundsFromArena({ width: 12, height: 8 })).toEqual({
      width: 12,
      height: 8,
      minX: -6,
      maxX: 6,
      minY: -4,
      maxY: 4
    });
  });
});
