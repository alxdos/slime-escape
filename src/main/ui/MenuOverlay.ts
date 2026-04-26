import type { ModePresetId, PlayableModeEntry } from '../../shared/content/sessions';

import { comicTextStyle } from './comicTextStyle';
import {
  MAIN_MENU_CONTROLS,
  MAIN_MENU_STAGE,
  MAIN_MENU_STAGE_WIDTH_VH,
  type MenuControlLayout
} from './MenuOverlayLayout';
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

  const style = document.createElement('style');
  style.textContent = menuOverlayCss();
  root.appendChild(style);

  const stage = document.createElement('div');
  stage.dataset['role'] = 'menu-stage';
  stage.style.cssText = stageStyle();

  const modeButtons = new Map<ModePresetId, HTMLButtonElement>();
  const controlButtons: HTMLButtonElement[] = [];
  let selectedMode: ModePresetId = DEFAULT_SELECTED_CAMPAIGN_MODE;
  let feedbackTimeout: number | null = null;

  const teaserFeedback = document.createElement('div');
  teaserFeedback.dataset['role'] = 'menu-teaser-feedback';
  teaserFeedback.style.cssText = teaserFeedbackStyle();
  stage.appendChild(teaserFeedback);

  for (const [index, control] of MAIN_MENU_CONTROLS.entries()) {
    const button = createControlButton(control, index, handleControl);
    controlButtons.push(button);
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
      restartAppearAnimations();
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

  function restartAppearAnimations(): void {
    for (const button of controlButtons) {
      button.classList.remove('menu-control-enter');
    }
    for (const button of controlButtons) {
      void button.offsetWidth;
      button.classList.add('menu-control-enter');
    }
  }
}

function createControlButton(
  control: MenuControlLayout,
  index: number,
  onControl: (controlId: MenuControlLayout['id']) => void
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'menu-image-button';
  button.dataset['role'] = 'menu-image-button';
  button.dataset['controlId'] = control.id;
  button.dataset['controlKind'] = control.kind;
  if (control.kind === 'teaser' || control.id === 'soon') {
    button.dataset['soon'] = 'true';
  }
  button.setAttribute('aria-label', control.label);
  if (isCampaignModeControl(control.id)) {
    button.setAttribute('aria-pressed', 'false');
  }
  button.style.cssText = controlButtonStyle(control, index);

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
    `width:min(100vw, ${MAIN_MENU_STAGE_WIDTH_VH.toFixed(3)}vh)`,
    `aspect-ratio:${MAIN_MENU_STAGE.width} / ${MAIN_MENU_STAGE.height}`,
    `background-image:url("${MAIN_MENU_STAGE.background}")`,
    'background-size:100% 100%',
    'background-position:center',
    'background-repeat:no-repeat',
    'overflow:hidden',
    'flex:0 0 auto'
  ].join(';');
}

function controlButtonStyle(control: MenuControlLayout, index: number): string {
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
    'touch-action:manipulation',
    `animation-delay:${index * 35}ms`
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
    ...comicTextStyle({
      fontSize: '32px',
      color: '#f8f0a8',
      textAlign: 'center'
    }),
    'pointer-events:none',
    'transition:opacity 140ms ease'
  ].join(';');
}

function menuOverlayCss(): string {
  return `
@keyframes menu-control-appear {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes menu-control-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes menu-selected-breathe {
  0%, 100% {
    filter:
      brightness(1.08)
      drop-shadow(2px 0 0 #7cf58f)
      drop-shadow(-2px 0 0 #7cf58f)
      drop-shadow(0 2px 0 #7cf58f)
      drop-shadow(0 -2px 0 #7cf58f);
  }
  50% {
    filter:
      brightness(1.16)
      drop-shadow(2px 0 0 #fff38b)
      drop-shadow(-2px 0 0 #fff38b)
      drop-shadow(0 2px 0 #fff38b)
      drop-shadow(0 -2px 0 #fff38b);
  }
}

.menu-image-button {
  opacity: 1;
  transform: scale(1);
  outline: none;
}

.menu-image-button.menu-control-enter {
  animation-name: menu-control-appear;
  animation-duration: 360ms;
  animation-timing-function: cubic-bezier(0.2, 0.9, 0.2, 1.15);
  animation-fill-mode: both;
}

.menu-image-button img {
  transition: filter 140ms ease, transform 140ms ease, opacity 140ms ease;
  filter: none;
}

.menu-image-button:hover img,
.menu-image-button:focus-visible img {
  filter: brightness(1.12) saturate(1.03) drop-shadow(6px 6px 0 #000000);
  transform: translate(-1px, -1px) scale(1.015);
}

.menu-image-button[data-selected="true"] img {
  animation: menu-selected-breathe 1500ms ease-in-out infinite;
}

.menu-image-button[data-soon="true"] img {
  filter: saturate(0.86) brightness(0.92);
}

.menu-image-button[data-soon="true"]:hover img,
.menu-image-button[data-soon="true"]:focus-visible img {
  filter: saturate(1) brightness(1.06) drop-shadow(5px 5px 0 #000000);
}

@media (prefers-reduced-motion: reduce) {
  .menu-image-button.menu-control-enter {
    animation-name: menu-control-fade;
    animation-duration: 160ms;
    animation-timing-function: ease;
  }

  .menu-image-button,
  .menu-image-button:hover img,
  .menu-image-button:focus-visible img {
    transform: none;
  }

  .menu-image-button[data-selected="true"] img {
    animation: none;
    filter:
      brightness(1.1)
      drop-shadow(2px 0 0 #7cf58f)
      drop-shadow(-2px 0 0 #7cf58f)
      drop-shadow(0 2px 0 #7cf58f)
      drop-shadow(0 -2px 0 #7cf58f);
  }
}
`;
}
