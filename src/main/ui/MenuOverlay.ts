import type { ModePresetId, PlayableModeEntry } from '../../shared/content/sessions';

import { MAIN_MENU_CONTROLS, MAIN_MENU_STAGE, type MenuControlLayout } from './MenuOverlayLayout';

export type MenuOverlayInit = Readonly<{
  parent: HTMLElement;
  modes: ReadonlyArray<PlayableModeEntry>;
  onStart(presetId: ModePresetId): void;
  onOpenSettings(): void;
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

  for (const control of MAIN_MENU_CONTROLS) {
    stage.appendChild(createControlButton(control, init));
  }

  root.appendChild(stage);
  init.parent.appendChild(root);

  let visible = true;

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
      root.remove();
    }
  };
}

function createControlButton(
  control: MenuControlLayout,
  init: MenuOverlayInit
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset['role'] = 'menu-image-button';
  button.dataset['controlId'] = control.id;
  button.dataset['controlKind'] = control.kind;
  button.ariaLabel = control.label;
  button.style.cssText = controlButtonStyle(control);

  const image = document.createElement('img');
  image.alt = '';
  image.src = control.src;
  image.draggable = false;
  image.style.cssText = controlImageStyle();
  button.appendChild(image);

  if (control.id === 'settings') {
    button.addEventListener('click', () => init.onOpenSettings());
  }

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
