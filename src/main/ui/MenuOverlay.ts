import type { ModePresetId, PlayableModeEntry } from '../../shared/content/sessions';

import { MAIN_MENU_CONTROLS, MAIN_MENU_STAGE, type MenuControlLayout } from './MenuOverlayLayout';
import {
  CAMPAIGN_MODE_BY_CONTROL,
  DEFAULT_SELECTED_CAMPAIGN_MODE,
  isCampaignModeControl,
  resolveMenuControlAction,
  type TeaserControlId
} from './MenuOverlayState';

export type MenuOverlayInit = Readonly<{
  parent: HTMLElement;
  modes: ReadonlyArray<PlayableModeEntry>;
  onStart(presetId: ModePresetId): void;
  onStartTraining(): void;
  onOpenSettings(): void;
  onToggleFullscreen(): void;
  onTeaser(controlId: TeaserControlId): void;
}>;

export type MenuOverlay = Readonly<{
  show(): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}>;

export function createMenuOverlay(init: MenuOverlayInit): MenuOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'menu-overlay';
  root.style.cssText = baseOverlayStyle();

  const stage = document.createElement('div');
  stage.dataset['role'] = 'menu-stage';
  stage.style.cssText = stageStyle();

  const modeButtons = new Map<ModePresetId, HTMLButtonElement>();
  let selectedMode: ModePresetId = DEFAULT_SELECTED_CAMPAIGN_MODE;
  let feedbackTimeout: number | null = null;

  const teaserFeedback = document.createElement('div');
  teaserFeedback.dataset['role'] = 'menu-teaser-feedback';
  teaserFeedback.style.cssText = teaserFeedbackStyle();
  stage.appendChild(teaserFeedback);

  for (const control of MAIN_MENU_CONTROLS) {
    const button = createControlButton(control, handleControl);
    if (isCampaignModeControl(control.id)) {
      modeButtons.set(CAMPAIGN_MODE_BY_CONTROL[control.id], button);
    }
    stage.appendChild(button);
  }

  root.appendChild(stage);
  init.parent.appendChild(root);

  let visible = true;
  applyModeSelection();

  return {
    show(): void {
      visible = true;
      root.style.display = 'flex';
    },
    hide(): void {
      visible = false;
      root.style.display = 'none';
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {
      if (feedbackTimeout !== null) {
        window.clearTimeout(feedbackTimeout);
        feedbackTimeout = null;
      }
      root.remove();
    }
  };

  function handleControl(controlId: MenuControlLayout['id']): void {
    const action = resolveMenuControlAction(controlId, selectedMode);

    switch (action.kind) {
      case 'selectMode':
        selectedMode = action.presetId;
        applyModeSelection();
        return;
      case 'start':
        init.onStart(action.presetId);
        return;
      case 'startTraining':
        init.onStartTraining();
        return;
      case 'openSettings':
        init.onOpenSettings();
        return;
      case 'toggleFullscreen':
        init.onToggleFullscreen();
        return;
      case 'teaser':
        showTeaserFeedback();
        init.onTeaser(action.controlId);
        return;
    }
  }

  function applyModeSelection(): void {
    for (const [presetId, button] of modeButtons.entries()) {
      const selected = presetId === selectedMode;
      button.dataset['selected'] = selected ? 'true' : 'false';
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
  }

  function showTeaserFeedback(): void {
    teaserFeedback.textContent = 'Скоро';
    teaserFeedback.style.opacity = '1';
    if (feedbackTimeout !== null) {
      window.clearTimeout(feedbackTimeout);
    }
    feedbackTimeout = window.setTimeout(() => {
      teaserFeedback.style.opacity = '0';
      feedbackTimeout = null;
    }, 900);
  }
}

function createControlButton(
  control: MenuControlLayout,
  onControl: (controlId: MenuControlLayout['id']) => void
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset['role'] = 'menu-image-button';
  button.dataset['controlId'] = control.id;
  button.dataset['controlKind'] = control.kind;
  button.setAttribute('aria-label', control.label);
  if (isCampaignModeControl(control.id)) {
    button.setAttribute('aria-pressed', 'false');
  }
  button.style.cssText = controlButtonStyle(control);

  const image = document.createElement('img');
  image.alt = '';
  image.src = control.src;
  image.draggable = false;
  image.style.cssText = controlImageStyle();
  button.appendChild(image);

  button.addEventListener('click', () => onControl(control.id));

  return button;
}

function baseOverlayStyle(): string {
  return [
    'position:fixed',
    'inset:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-sizing:border-box',
    'overflow:auto',
    'background:#050505',
    'z-index:100',
    'cursor:default'
  ].join(';');
}

function stageStyle(): string {
  return [
    'position:relative',
    `width:min(100vw, calc(100vh * ${MAIN_MENU_STAGE.width / MAIN_MENU_STAGE.height}))`,
    `aspect-ratio:${MAIN_MENU_STAGE.width} / ${MAIN_MENU_STAGE.height}`,
    `background-image:url("${MAIN_MENU_STAGE.background}")`,
    'background-size:100% 100%',
    'background-position:center',
    'background-repeat:no-repeat',
    'overflow:hidden',
    'flex:0 0 auto'
  ].join(';');
}

function controlButtonStyle(control: MenuControlLayout): string {
  return [
    'appearance:none',
    'position:absolute',
    `left:${control.leftPercent}%`,
    `top:${control.topPercent}%`,
    `width:${control.widthPercent}%`,
    `aspect-ratio:${control.aspectRatio}`,
    'display:block',
    'padding:0',
    'margin:0',
    'border:0',
    'background:transparent',
    'cursor:pointer',
    'line-height:0',
    'touch-action:manipulation'
  ].join(';');
}

function controlImageStyle(): string {
  return [
    'display:block',
    'width:100%',
    'height:100%',
    'object-fit:contain',
    'pointer-events:none',
    'user-select:none'
  ].join(';');
}

function teaserFeedbackStyle(): string {
  return [
    'position:absolute',
    'left:38%',
    'top:61%',
    'width:24%',
    'opacity:0',
    'font-size:clamp(18px, 4vw, 36px)',
    'font-weight:900',
    'text-align:center',
    'color:#f8f0a8',
    '-webkit-text-stroke:1px #000000',
    'text-shadow:3px 3px 0 #000000',
    'pointer-events:none',
    'transition:opacity 140ms ease'
  ].join(';');
}
