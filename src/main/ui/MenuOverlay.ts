import type { ModePresetId, PlayableModeEntry } from '../../shared/content/sessions';

import { comicTextStyle } from './comicTextStyle';
import {
  MAIN_MENU_CONTROLS,
  MAIN_MENU_LOGO,
  MAIN_MENU_STAGE,
  MAIN_MENU_STAGE_WIDTH_VH,
  MENU_SUBSCREENS,
  type MenuImageLayout,
  type MenuControlLayout,
  type MenuScreenId,
  type MenuSubscreenControlLayout,
  type MenuSubscreenId
} from './MenuOverlayLayout';
import {
  CAMPAIGN_MODE_BY_CONTROL,
  DEFAULT_SELECTED_CAMPAIGN_MODE,
  isCampaignModeControl,
  resolveMenuControlAction,
  type TeaserControlId
} from './MenuOverlayState';
import { createSocialLinkRail } from './SocialLinkRail';

const TEASER_FEEDBACK_VISIBLE_MS = 7_000;
const TEASER_FEEDBACK_FADE_MS = 900;

export type MenuOverlayInit = Readonly<{
  parent: HTMLElement;
  modes: ReadonlyArray<PlayableModeEntry>;
  onStart(presetId: ModePresetId): void;
  onStartTraining(): void;
  onOpenSettings(): void;
  onToggleFullscreen(): void;
  onOpenScreen(screenId: MenuSubscreenId): void;
  onBackToMainMenu(): void;
  onTeaser(controlId: TeaserControlId): void;
  onStartDungeon(): void;
  onButtonHover(): void;
  onModeSwitch(): void;
  dungeonBestWave: number;
}>;

export type MenuOverlay = Readonly<{
  show(): void;
  hide(): void;
  showScreen(screenId: MenuScreenId): void;
  screen(): MenuScreenId;
  setDungeonBestWave(bestWave: number): void;
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

  const mainStage = document.createElement('div');
  mainStage.dataset['role'] = 'menu-stage';
  mainStage.style.cssText = stageStyle(MAIN_MENU_STAGE.background);

  const logo = createStageImage(MAIN_MENU_LOGO);
  mainStage.appendChild(logo);

  const modeButtons = new Map<ModePresetId, HTMLButtonElement>();
  const controlButtons: HTMLButtonElement[] = [];
  const subscreenButtons = new Map<MenuScreenId, HTMLButtonElement[]>();
  const subscreenStages = new Map<MenuSubscreenId, HTMLDivElement>();
  let selectedMode: ModePresetId = DEFAULT_SELECTED_CAMPAIGN_MODE;
  let activeScreen: MenuScreenId = 'main';
  let dungeonBestWave = formatDungeonBestWave(init.dungeonBestWave);
  let dungeonBestWaveElement: HTMLDivElement | null = null;
  let feedbackTimeout: number | null = null;

  const teaserFeedback = document.createElement('div');
  teaserFeedback.dataset['role'] = 'menu-teaser-feedback';
  teaserFeedback.style.cssText = teaserFeedbackStyle();

  for (const [index, control] of MAIN_MENU_CONTROLS.entries()) {
    const button = createControlButton(control, index, handleControl, init.onButtonHover);
    controlButtons.push(button);
    if (isCampaignModeControl(control.id)) {
      modeButtons.set(CAMPAIGN_MODE_BY_CONTROL[control.id], button);
    }
    mainStage.appendChild(button);
  }
  mainStage.appendChild(teaserFeedback);

  const socialLinks = createSocialLinkRail();
  socialLinks.className = `${socialLinks.className} menu-social-link-rail`;
  socialLinks.dataset['placement'] = 'menu';
  socialLinks.style.cssText = `${socialLinks.style.cssText};${menuSocialLinkRailStyle()}`;
  mainStage.appendChild(socialLinks);

  root.appendChild(mainStage);
  init.parent.appendChild(root);

  let visible = true;
  applyModeSelection();

  return {
    show(): void {
      visible = true;
      root.style.display = 'flex';
      applyScreenVisibility();
      restartActiveScreenAnimations();
    },
    hide(): void {
      visible = false;
      root.style.display = 'none';
    },
    showScreen(screenId): void {
      activeScreen = screenId;
      if (screenId !== 'main') {
        ensureSubscreenStage(screenId);
      }
      applyScreenVisibility();
      restartActiveScreenAnimations();
    },
    screen(): MenuScreenId {
      return activeScreen;
    },
    setDungeonBestWave(bestWave): void {
      dungeonBestWave = formatDungeonBestWave(bestWave);
      syncDungeonBestWave();
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
      case 'selectMode': {
        const previousMode = selectedMode;
        selectedMode = action.presetId;
        applyModeSelection();
        if (selectedMode !== previousMode) {
          init.onModeSwitch();
        }
        return;
      }
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
      case 'openScreen':
        init.onOpenScreen(action.screenId);
        return;
      case 'teaser':
        showTeaserFeedback();
        init.onTeaser(action.controlId);
        return;
    }
  }

  function handleSubscreenControl(control: MenuSubscreenControlLayout): void {
    switch (control.kind) {
      case 'back':
        init.onBackToMainMenu();
        return;
      case 'mode':
        return;
      case 'start':
        if (control.id === 'dungeon-play') {
          init.onStartDungeon();
        }
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
    activeStage().appendChild(teaserFeedback);
    teaserFeedback.textContent = 'Coming Soon';
    teaserFeedback.style.opacity = '1';
    if (feedbackTimeout !== null) {
      window.clearTimeout(feedbackTimeout);
    }
    feedbackTimeout = window.setTimeout(() => {
      teaserFeedback.style.opacity = '0';
      feedbackTimeout = null;
    }, TEASER_FEEDBACK_VISIBLE_MS);
  }

  function syncDungeonBestWave(): void {
    if (dungeonBestWaveElement === null) {
      return;
    }
    dungeonBestWaveElement.textContent = dungeonBestWave;
  }

  function activeStage(): HTMLDivElement {
    if (activeScreen === 'main') {
      return mainStage;
    }
    return ensureSubscreenStage(activeScreen);
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

  function restartSubscreenAnimations(screenId: MenuScreenId): void {
    for (const button of subscreenButtons.get(screenId) ?? []) {
      button.classList.remove('menu-control-enter');
    }
    for (const button of subscreenButtons.get(screenId) ?? []) {
      void button.offsetWidth;
      button.classList.add('menu-control-enter');
    }
  }

  function restartActiveScreenAnimations(): void {
    if (activeScreen === 'main') {
      restartAppearAnimations();
      return;
    }
    restartSubscreenAnimations(activeScreen);
  }

  function applyScreenVisibility(): void {
    mainStage.style.display = activeScreen === 'main' ? 'block' : 'none';
    for (const [screenId, stage] of subscreenStages.entries()) {
      stage.style.display = activeScreen === screenId ? 'block' : 'none';
    }
  }

  function ensureSubscreenStage(screenId: MenuSubscreenId): HTMLDivElement {
    const existingStage = subscreenStages.get(screenId);
    if (existingStage !== undefined) {
      return existingStage;
    }

    const layout = MENU_SUBSCREENS[screenId];
    const stage = document.createElement('div');
    stage.dataset['role'] = 'menu-subscreen-stage';
    stage.dataset['screenId'] = screenId;
    stage.style.cssText = `${stageStyle(layout.background)};display:none`;

    const buttons: HTMLButtonElement[] = [];
    for (const [index, control] of layout.controls.entries()) {
      const button = createSubscreenControlButton(
        control,
        index,
        handleSubscreenControl,
        init.onButtonHover
      );
      buttons.push(button);
      stage.appendChild(button);
    }
    if (screenId === 'dungeon') {
      dungeonBestWaveElement = createDungeonBestWaveElement();
      syncDungeonBestWave();
      stage.appendChild(dungeonBestWaveElement);
    }

    subscreenButtons.set(screenId, buttons);
    subscreenStages.set(screenId, stage);
    root.appendChild(stage);
    return stage;
  }
}

function createDungeonBestWaveElement(): HTMLDivElement {
  const element = document.createElement('div');
  element.dataset['role'] = 'menu-dungeon-best-wave';
  element.setAttribute('aria-label', 'Max wave');
  element.style.cssText = dungeonBestWaveStyle();
  return element;
}

function formatDungeonBestWave(bestWave: number): string {
  if (!Number.isFinite(bestWave) || bestWave <= 0) {
    return '0';
  }
  return String(Math.floor(bestWave));
}

function createStageImage(layout: MenuImageLayout): HTMLImageElement {
  const image = document.createElement('img');
  if (layout.id === 'logo') {
    image.className = 'menu-stage-logo';
  }
  image.dataset['role'] = `menu-${layout.id}`;
  image.alt = layout.alt;
  image.src = layout.src;
  image.draggable = false;
  image.style.cssText = stageImageStyle(layout);
  return image;
}

function createControlButton(
  control: MenuControlLayout,
  index: number,
  onControl: (controlId: MenuControlLayout['id']) => void,
  onHover: () => void
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
  button.addEventListener('pointerenter', onHover);

  return button;
}

function createSubscreenControlButton(
  control: MenuSubscreenControlLayout,
  index: number,
  onControl: (control: MenuSubscreenControlLayout) => void,
  onHover: () => void
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'menu-image-button';
  button.dataset['role'] = 'menu-subscreen-button';
  button.dataset['controlId'] = control.id;
  button.dataset['controlKind'] = control.kind;
  if (control.selected === true) {
    button.dataset['selected'] = 'true';
    button.setAttribute('aria-pressed', 'true');
    if (control.selectedTone !== undefined) {
      button.dataset['selectedTone'] = control.selectedTone;
    }
  }
  button.setAttribute('aria-label', control.label);
  button.style.cssText = controlButtonStyle(control, index);

  const image = document.createElement('img');
  image.alt = '';
  image.src = control.src;
  image.draggable = false;
  image.style.cssText = controlImageStyle();
  button.appendChild(image);

  button.addEventListener('click', () => onControl(control));
  button.addEventListener('pointerenter', onHover);

  return button;
}

function dungeonBestWaveStyle(): string {
  return [
    'position:absolute',
    'left:31.6%',
    'top:55.2%',
    'width:33.8%',
    'height:27.8%',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'z-index:20',
    'overflow:hidden',
    ...comicTextStyle({
      fontSize: '48px',
      color: '#2a1711',
      textAlign: 'center'
    }),
    'font-size:min(6.2cqw, 8.8cqh, 58px)',
    '-webkit-text-stroke:0',
    'text-shadow:none',
    'pointer-events:none',
    'user-select:none'
  ].join(';');
}

function stageImageStyle(layout: MenuImageLayout): string {
  return [
    'position:absolute',
    `left:${layout.leftPercent}%`,
    `top:${layout.topPercent}%`,
    `width:${layout.widthPercent}%`,
    `aspect-ratio:${layout.aspectRatio}`,
    'display:block',
    'height:auto',
    'object-fit:contain',
    layout.id === 'logo' ? 'pointer-events:auto' : 'pointer-events:none',
    layout.id === 'logo' ? 'cursor:default' : '',
    'user-select:none'
  ].filter(Boolean).join(';');
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

function stageStyle(background: string): string {
  return [
    'position:relative',
    `width:min(100vw, ${MAIN_MENU_STAGE_WIDTH_VH.toFixed(3)}vh)`,
    `aspect-ratio:${MAIN_MENU_STAGE.width} / ${MAIN_MENU_STAGE.height}`,
    `background-image:url("${background}")`,
    'background-size:100% 100%',
    'background-position:center',
    'background-repeat:no-repeat',
    'container-type:size',
    'overflow:hidden',
    'flex:0 0 auto'
  ].join(';');
}

function controlButtonStyle(
  control: Readonly<{
    leftPercent: number;
    topPercent?: number;
    bottomPercent?: number;
    widthPercent: number;
    aspectRatio: number;
  }>,
  index: number
): string {
  return [
    'appearance:none',
    'position:absolute',
    `left:${control.leftPercent}%`,
    control.bottomPercent === undefined
      ? `top:${control.topPercent ?? 0}%`
      : `bottom:${control.bottomPercent}%`,
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
    'left:50%',
    'top:6%',
    'width:36%',
    'transform:translateX(-50%)',
    'z-index:30',
    'opacity:0',
    ...comicTextStyle({
      fontSize: '40px',
      color: '#f8f0a8',
      textAlign: 'center'
    }),
    'pointer-events:none',
    `transition:opacity ${TEASER_FEEDBACK_FADE_MS}ms ease`
  ].join(';');
}

function menuSocialLinkRailStyle(): string {
  return [
    'position:absolute',
    'left:3.4%',
    'top:38%',
    'z-index:35',
    'transform:translateY(-50%) scale(0.9)',
    'transform-origin:left center'
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

@keyframes menu-play-breathe {
  0%, 100% {
    filter: brightness(1) saturate(1);
    transform: scale(1);
  }
  50% {
    filter: brightness(1.12) saturate(1.06);
    transform: scale(1.025);
  }
}

.menu-stage-logo {
  filter:
    brightness(1)
    saturate(1)
    drop-shadow(0 0 0 rgba(124, 245, 143, 0))
    drop-shadow(0 0 0 rgba(125, 199, 255, 0));
  transition: filter 460ms ease-out;
}

.menu-stage-logo:hover {
  filter:
    brightness(1.22)
    saturate(1.14)
    drop-shadow(0 0 10px rgba(124, 245, 143, 0.86))
    drop-shadow(0 0 18px rgba(125, 199, 255, 0.7));
}

.menu-image-button {
  opacity: 1;
  transform: scale(1);
  transition: filter 140ms ease, transform 140ms ease;
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
  filter:
    brightness(1.08)
    drop-shadow(3px 0 0 #7cf58f)
    drop-shadow(-3px 0 0 #7cf58f)
    drop-shadow(0 3px 0 #7cf58f)
    drop-shadow(0 -3px 0 #7cf58f)
    drop-shadow(2px 2px 0 #7cf58f)
    drop-shadow(-2px 2px 0 #7cf58f)
    drop-shadow(2px -2px 0 #7cf58f)
    drop-shadow(-2px -2px 0 #7cf58f);
}

.menu-image-button[data-control-id="play"] img {
  animation: menu-play-breathe 1800ms ease-in-out infinite;
}

.menu-image-button[data-control-id="play"]:hover,
.menu-image-button[data-control-id="play"]:focus-visible {
  filter: drop-shadow(6px 6px 0 #000000);
  transform: translate(-1px, -1px) scale(1.015);
}

.menu-image-button[data-selected="true"]:hover img,
.menu-image-button[data-selected="true"]:focus-visible img {
  animation: none;
  filter:
    brightness(1.14)
    saturate(1.04)
    drop-shadow(3px 0 0 #7cf58f)
    drop-shadow(-3px 0 0 #7cf58f)
    drop-shadow(0 3px 0 #7cf58f)
    drop-shadow(0 -3px 0 #7cf58f)
    drop-shadow(2px 2px 0 #7cf58f)
    drop-shadow(-2px 2px 0 #7cf58f)
    drop-shadow(2px -2px 0 #7cf58f)
    drop-shadow(-2px -2px 0 #7cf58f)
    drop-shadow(6px 6px 0 #000000);
  transform: translate(-1px, -1px) scale(1.015);
}

.menu-image-button[data-selected="true"][data-selected-tone="lava"] img {
  filter:
    brightness(1.08)
    saturate(1.08)
    drop-shadow(3px 0 0 #ff7a1a)
    drop-shadow(-3px 0 0 #ff7a1a)
    drop-shadow(0 3px 0 #ff7a1a)
    drop-shadow(0 -3px 0 #ff7a1a)
    drop-shadow(2px 2px 0 #ffb13d)
    drop-shadow(-2px 2px 0 #ffb13d)
    drop-shadow(2px -2px 0 #d93600)
    drop-shadow(-2px -2px 0 #d93600);
}

.menu-image-button[data-selected="true"][data-selected-tone="lava"]:hover img,
.menu-image-button[data-selected="true"][data-selected-tone="lava"]:focus-visible img {
  filter:
    brightness(1.16)
    saturate(1.12)
    drop-shadow(3px 0 0 #ff7a1a)
    drop-shadow(-3px 0 0 #ff7a1a)
    drop-shadow(0 3px 0 #ff7a1a)
    drop-shadow(0 -3px 0 #ff7a1a)
    drop-shadow(2px 2px 0 #ffb13d)
    drop-shadow(-2px 2px 0 #ffb13d)
    drop-shadow(2px -2px 0 #d93600)
    drop-shadow(-2px -2px 0 #d93600)
    drop-shadow(6px 6px 0 #000000);
}

.menu-image-button[data-soon="true"] img {
  filter: saturate(0.86) brightness(0.92);
}

.menu-image-button[data-soon="true"]:hover img,
.menu-image-button[data-soon="true"]:focus-visible img {
  filter: saturate(1) brightness(1.06) drop-shadow(5px 5px 0 #000000);
}

@media (max-width: 560px) {
  .menu-social-link-rail {
    transform: translateY(-50%) scale(0.78) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .menu-image-button.menu-control-enter {
    animation-name: menu-control-fade;
    animation-duration: 160ms;
    animation-timing-function: ease;
  }

  .menu-image-button,
  .menu-image-button[data-control-id="play"]:hover,
  .menu-image-button[data-control-id="play"]:focus-visible,
  .menu-image-button:hover img,
  .menu-image-button:focus-visible img {
    transform: none;
  }

  .menu-image-button[data-selected="true"] img {
    filter:
      brightness(1.1)
      drop-shadow(3px 0 0 #7cf58f)
      drop-shadow(-3px 0 0 #7cf58f)
      drop-shadow(0 3px 0 #7cf58f)
      drop-shadow(0 -3px 0 #7cf58f)
      drop-shadow(2px 2px 0 #7cf58f)
      drop-shadow(-2px 2px 0 #7cf58f)
      drop-shadow(2px -2px 0 #7cf58f)
      drop-shadow(-2px -2px 0 #7cf58f);
  }

  .menu-image-button[data-selected="true"][data-selected-tone="lava"] img {
    filter:
      brightness(1.1)
      saturate(1.08)
      drop-shadow(3px 0 0 #ff7a1a)
      drop-shadow(-3px 0 0 #ff7a1a)
      drop-shadow(0 3px 0 #ff7a1a)
      drop-shadow(0 -3px 0 #ff7a1a)
      drop-shadow(2px 2px 0 #ffb13d)
      drop-shadow(-2px 2px 0 #ffb13d)
      drop-shadow(2px -2px 0 #d93600)
      drop-shadow(-2px -2px 0 #d93600);
  }

  .menu-image-button[data-control-id="play"] img {
    animation: none;
  }

  .menu-stage-logo:hover {
    filter:
      brightness(1.18)
      saturate(1.1)
      drop-shadow(0 0 12px rgba(124, 245, 143, 0.72));
  }

  .menu-image-button[data-selected="true"]:hover img,
  .menu-image-button[data-selected="true"]:focus-visible img {
    filter:
      brightness(1.14)
      saturate(1.04)
      drop-shadow(3px 0 0 #7cf58f)
      drop-shadow(-3px 0 0 #7cf58f)
      drop-shadow(0 3px 0 #7cf58f)
      drop-shadow(0 -3px 0 #7cf58f)
      drop-shadow(2px 2px 0 #7cf58f)
      drop-shadow(-2px 2px 0 #7cf58f)
      drop-shadow(2px -2px 0 #7cf58f)
      drop-shadow(-2px -2px 0 #7cf58f)
      drop-shadow(6px 6px 0 #000000);
  }

  .menu-image-button[data-selected="true"][data-selected-tone="lava"]:hover img,
  .menu-image-button[data-selected="true"][data-selected-tone="lava"]:focus-visible img {
    filter:
      brightness(1.16)
      saturate(1.12)
      drop-shadow(3px 0 0 #ff7a1a)
      drop-shadow(-3px 0 0 #ff7a1a)
      drop-shadow(0 3px 0 #ff7a1a)
      drop-shadow(0 -3px 0 #ff7a1a)
      drop-shadow(2px 2px 0 #ffb13d)
      drop-shadow(-2px 2px 0 #ffb13d)
      drop-shadow(2px -2px 0 #d93600)
      drop-shadow(-2px -2px 0 #d93600)
      drop-shadow(6px 6px 0 #000000);
  }
}
`;
}
