import { detectFeatures } from './featureDetection';
import {
  createGameSurfaceController,
  detectMobileWebProfile
} from './mobileWebProfile';
import { installPageInteractionBlockers } from './pageContextMenu';
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
    SLIME_ESCAPE_AUTO_START_PUBLIC_ARENA?: boolean;
    SLIME_ESCAPE_LOADING_IMAGE_SRC?: string;
  }>;

function requireCanvas(selector: string): HTMLCanvasElement {
  const el = document.querySelector<HTMLCanvasElement>(selector);
  if (!el) {
    throw new Error(`canvas not found by selector "${selector}"`);
  }
  return el;
}

function requireElement(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) {
    throw new Error(`element not found by selector "${selector}"`);
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

function resolveAutoStartPublicArena(windowTarget: SlimeEscapeWindow): boolean {
  return windowTarget.SLIME_ESCAPE_AUTO_START_PUBLIC_ARENA === true;
}

function isModePresetId(value: unknown): value is ModePresetId {
  return typeof value === 'string' && value in SESSION_PRESET_TEMPLATES;
}

function resolveLoadingImageSrc(windowTarget: SlimeEscapeWindow): string | undefined {
  const imageSrc = windowTarget.SLIME_ESCAPE_LOADING_IMAGE_SRC;
  return typeof imageSrc === 'string' && imageSrc.trim().length > 0 ? imageSrc : undefined;
}

detectFeatures();
installPageInteractionBlockers(document);
const gameRoot = requireElement('#app');
const canvas = requireCanvas('#scene');
const gameSurface = createGameSurfaceController({
  root: gameRoot,
  profile: detectMobileWebProfile({
    maxTouchPoints: navigator.maxTouchPoints,
    screenWidth: screen.width,
    screenHeight: screen.height
  }),
  windowTarget: window
});
const fps = createFpsOverlay(gameRoot);
const uiShell = createUiShell({
  parent: gameRoot,
  canvas,
  gameViewport: gameSurface,
  mobileProfile: gameSurface.profile,
  autoStartPresetId: resolveAutoStartPresetId(window as SlimeEscapeWindow),
  autoStartPublicArena: resolveAutoStartPublicArena(window as SlimeEscapeWindow),
  startupImageSrc: resolveLoadingImageSrc(window as SlimeEscapeWindow)
});

function tick(nowMs: number): void {
  fps.onFrame(nowMs);
  uiShell.onFrame();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
