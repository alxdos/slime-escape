import type { ModePresetId } from '../../shared/content/sessions';
import { assertNever } from '../../shared/protocol';

import type { MenuControlId, MenuSubscreenId } from './MenuOverlayLayout';

export type CampaignModeControlId = 'mode-easy' | 'mode-normal' | 'mode-hard';
export type TeaserControlId = 'soon';

export type MenuControlAction =
  | Readonly<{ kind: 'selectMode'; presetId: ModePresetId }>
  | Readonly<{ kind: 'start'; presetId: ModePresetId }>
  | Readonly<{ kind: 'startTraining' }>
  | Readonly<{ kind: 'openSettings' }>
  | Readonly<{ kind: 'toggleFullscreen' }>
  | Readonly<{ kind: 'openScreen'; screenId: MenuSubscreenId }>
  | Readonly<{ kind: 'teaser'; controlId: TeaserControlId }>;

export const DEFAULT_SELECTED_CAMPAIGN_MODE: ModePresetId = 'campaign-normal';

export const CAMPAIGN_MODE_BY_CONTROL = Object.freeze({
  'mode-easy': 'campaign-easy',
  'mode-normal': 'campaign-normal',
  'mode-hard': 'campaign-hard'
}) satisfies Readonly<Record<CampaignModeControlId, ModePresetId>>;

const TEASER_CONTROL_IDS = new Set<MenuControlId>(['soon']);

export function isCampaignModeControl(
  controlId: MenuControlId
): controlId is CampaignModeControlId {
  return controlId in CAMPAIGN_MODE_BY_CONTROL;
}

export function isTeaserControl(controlId: MenuControlId): controlId is TeaserControlId {
  return TEASER_CONTROL_IDS.has(controlId);
}

export function resolveMenuControlAction(
  controlId: MenuControlId,
  selectedMode: ModePresetId
): MenuControlAction {
  if (isCampaignModeControl(controlId)) {
    return {
      kind: 'selectMode',
      presetId: CAMPAIGN_MODE_BY_CONTROL[controlId]
    };
  }

  switch (controlId) {
    case 'play':
      return { kind: 'start', presetId: selectedMode };
    case 'training':
      return { kind: 'startTraining' };
    case 'settings':
      return { kind: 'openSettings' };
    case 'fullscreen':
      return { kind: 'toggleFullscreen' };
    case 'pets':
    case 'dungeon':
    case 'lab':
      return { kind: 'openScreen', screenId: controlId };
    case 'soon':
      return { kind: 'teaser', controlId };
    default:
      return assertNever(controlId);
  }
}
