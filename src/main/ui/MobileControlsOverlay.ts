import { COMIC_TEXT_FONT_FAMILY } from './comicTextStyle';

export type MobileControlsOverlayInit = Readonly<{
  parent: HTMLElement;
}>;

export type MobileControlsOverlay = Readonly<{
  show(): void;
  hide(): void;
  isVisible(): boolean;
  pauseButtonElement(): HTMLElement;
  dispose(): void;
}>;

export function createMobileControlsOverlay(
  init: MobileControlsOverlayInit
): MobileControlsOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'mobile-controls';
  root.style.cssText = rootStyle();
  root.style.display = 'none';

  const fireLeft = createBulletCluster('left');
  const fireRight = createBulletCluster('right');
  const moveStick = createStick('Move', 'left');
  const aimStick = createStick('Aim', 'right');
  const pauseButton = createPauseButton();

  root.appendChild(fireLeft);
  root.appendChild(fireRight);
  root.appendChild(moveStick);
  root.appendChild(aimStick);
  root.appendChild(pauseButton);
  init.parent.appendChild(root);

  let visible = false;

  return {
    show(): void {
      visible = true;
      root.style.display = 'block';
    },
    hide(): void {
      visible = false;
      root.style.display = 'none';
    },
    isVisible(): boolean {
      return visible;
    },
    pauseButtonElement(): HTMLElement {
      return pauseButton;
    },
    dispose(): void {
      root.remove();
    }
  };
}

function createBulletCluster(side: 'left' | 'right'): HTMLElement {
  const root = document.createElement('div');
  root.dataset['role'] = `mobile-fire-affordance-${side}`;
  root.style.cssText = bulletClusterStyle(side);
  for (let index = 0; index < 3; index += 1) {
    const bullet = document.createElement('span');
    bullet.style.cssText = bulletStyle(index);
    root.appendChild(bullet);
  }
  return root;
}

function createStick(label: string, side: 'left' | 'right'): HTMLElement {
  const root = document.createElement('div');
  root.dataset['role'] = `mobile-${side === 'left' ? 'move' : 'aim'}-stick`;
  root.setAttribute('aria-label', label);
  root.style.cssText = stickStyle(side);

  const ring = document.createElement('div');
  ring.style.cssText = stickRingStyle();
  const knob = document.createElement('div');
  knob.style.cssText = stickKnobStyle();
  ring.appendChild(knob);
  root.appendChild(ring);
  return root;
}

function createPauseButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset['role'] = 'mobile-pause-button';
  button.setAttribute('aria-label', 'Pause');
  button.style.cssText = pauseButtonStyle();
  for (let index = 0; index < 2; index += 1) {
    const bar = document.createElement('span');
    bar.style.cssText = pauseBarStyle();
    button.appendChild(bar);
  }
  return button;
}

function rootStyle(): string {
  return [
    'position:fixed',
    'inset:0',
    'z-index:75',
    'pointer-events:none',
    'touch-action:none',
    `font-family:${COMIC_TEXT_FONT_FAMILY}`
  ].join(';');
}

function bulletClusterStyle(side: 'left' | 'right'): string {
  return [
    'position:fixed',
    'top:22px',
    side === 'left' ? 'left:24px' : 'right:24px',
    'display:flex',
    'gap:7px',
    'opacity:0.3',
    'filter:drop-shadow(0 4px 10px rgba(0,0,0,0.35))',
    'pointer-events:none'
  ].join(';');
}

function bulletStyle(index: number): string {
  return [
    'display:block',
    'width:10px',
    'height:24px',
    'border:1px solid rgba(255,255,255,0.5)',
    'border-radius:8px 8px 5px 5px',
    'background:linear-gradient(180deg, rgba(255,238,140,0.74), rgba(255,170,74,0.2))',
    `transform:translateY(${index % 2 === 0 ? 0 : 6}px) rotate(${index - 1}deg)`
  ].join(';');
}

function stickStyle(side: 'left' | 'right'): string {
  return [
    'position:fixed',
    'bottom:30px',
    side === 'left' ? 'left:42px' : 'right:42px',
    'width:116px',
    'height:116px',
    'display:grid',
    'place-items:center',
    'opacity:0.34',
    'pointer-events:none'
  ].join(';');
}

function stickRingStyle(): string {
  return [
    'width:100%',
    'height:100%',
    'box-sizing:border-box',
    'border:2px solid rgba(255,255,255,0.42)',
    'border-radius:999px',
    'background:radial-gradient(circle, rgba(255,255,255,0.1) 0 42%, rgba(255,255,255,0.02) 43% 100%)',
    'box-shadow:0 10px 26px rgba(0,0,0,0.22)'
  ].join(';');
}

function stickKnobStyle(): string {
  return [
    'position:absolute',
    'left:50%',
    'top:50%',
    'width:38px',
    'height:38px',
    'transform:translate(-50%, -50%)',
    'border-radius:999px',
    'background:rgba(255,255,255,0.34)',
    'box-shadow:inset 0 1px 0 rgba(255,255,255,0.18)'
  ].join(';');
}

function pauseButtonStyle(): string {
  return [
    'position:fixed',
    'top:12px',
    'left:50%',
    'transform:translateX(-50%)',
    'width:58px',
    'height:42px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'gap:7px',
    'padding:0',
    'border:1px solid rgba(255,255,255,0.34)',
    'border-radius:8px',
    'background:rgba(6,10,18,0.46)',
    'box-shadow:0 8px 22px rgba(0,0,0,0.22)',
    'pointer-events:auto',
    'touch-action:none',
    'cursor:pointer'
  ].join(';');
}

function pauseBarStyle(): string {
  return [
    'display:block',
    'width:6px',
    'height:20px',
    'border-radius:3px',
    'background:rgba(255,255,255,0.78)'
  ].join(';');
}
