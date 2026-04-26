import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SELECTED_CAMPAIGN_MODE,
  resolveMenuControlAction
} from './MenuOverlayState';

describe('MenuOverlayState', () => {
  it('defaults to normal campaign mode and maps difficulty controls directly', () => {
    expect(DEFAULT_SELECTED_CAMPAIGN_MODE).toBe('campaign-normal');
    expect(resolveMenuControlAction('mode-easy', DEFAULT_SELECTED_CAMPAIGN_MODE)).toEqual({
      kind: 'selectMode',
      presetId: 'campaign-easy'
    });
    expect(resolveMenuControlAction('mode-normal', 'campaign-hard')).toEqual({
      kind: 'selectMode',
      presetId: 'campaign-normal'
    });
    expect(resolveMenuControlAction('mode-hard', DEFAULT_SELECTED_CAMPAIGN_MODE)).toEqual({
      kind: 'selectMode',
      presetId: 'campaign-hard'
    });
  });

  it('routes play, training, settings, fullscreen and teasers', () => {
    expect(resolveMenuControlAction('play', 'campaign-hard')).toEqual({
      kind: 'start',
      presetId: 'campaign-hard'
    });
    expect(resolveMenuControlAction('training', DEFAULT_SELECTED_CAMPAIGN_MODE)).toEqual({
      kind: 'startTraining'
    });
    expect(resolveMenuControlAction('settings', DEFAULT_SELECTED_CAMPAIGN_MODE)).toEqual({
      kind: 'openSettings'
    });
    expect(resolveMenuControlAction('fullscreen', DEFAULT_SELECTED_CAMPAIGN_MODE)).toEqual({
      kind: 'toggleFullscreen'
    });
    expect(resolveMenuControlAction('pets', DEFAULT_SELECTED_CAMPAIGN_MODE)).toEqual({
      kind: 'teaser',
      controlId: 'pets'
    });
  });
});
