import { detectFeatures } from './featureDetection';
import { createFpsOverlay } from './render/FpsOverlay';
import { createUiShell } from './ui/UiShell';
import {
  SESSION_PRESET_TEMPLATES,
  type ModePresetId
} from '../shared/content/sessions';

const DEFAULT_AUTO_START_PRESET_ID: ModePresetId = 'campaign-normal';

type SlimeEscapeWindow = Window &
  Readonly<{
    SLIME_ESCAPE_AUTO_START?: boolean | ModePresetId;
    SLIME_ESCAPE_LOADING_IMAGE_SRC?: string;
  }>;

function requireCanvas(selector: string): HTMLCanvasElement {
  const el = document.querySelector<HTMLCanvasElement>(selector);
  if (!el) {
    throw new Error(`canvas not found by selector "${selector}"`);
  }
  return el;
}

function resolveAutoStartPresetId(windowTarget: SlimeEscapeWindow): ModePresetId | undefined {
  const globalFlag = windowTarget.SLIME_ESCAPE_AUTO_START;
  if (globalFlag === true) {
    return DEFAULT_AUTO_START_PRESET_ID;
  }
  if (isModePresetId(globalFlag)) {
    return globalFlag;
  }
  return undefined;
}

function isModePresetId(value: unknown): value is ModePresetId {
  return typeof value === 'string' && value in SESSION_PRESET_TEMPLATES;
}

function resolveLoadingImageSrc(windowTarget: SlimeEscapeWindow): string | undefined {
  const imageSrc = windowTarget.SLIME_ESCAPE_LOADING_IMAGE_SRC;
  return typeof imageSrc === 'string' && imageSrc.trim().length > 0 ? imageSrc : undefined;
}

detectFeatures();
const canvas = requireCanvas('#scene');
const fps = createFpsOverlay(document.body);
const uiShell = createUiShell({
  parent: document.body,
  canvas,
  autoStartPresetId: resolveAutoStartPresetId(window as SlimeEscapeWindow),
  startupImageSrc: resolveLoadingImageSrc(window as SlimeEscapeWindow)
});

function tick(nowMs: number): void {
  fps.onFrame(nowMs);
  uiShell.onFrame();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
