import { comicTextStyle } from './comicTextStyle';

export type PauseOverlayInit = Readonly<{
  parent: HTMLElement;
  onResume(): void;
  onExit(): void;
  onOpenSettings(): void;
}>;

export type PauseOverlay = Readonly<{
  show(): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}>;

export function createPauseOverlay(init: PauseOverlayInit): PauseOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'pause-overlay';
  root.style.cssText = baseOverlayStyle();

  const style = document.createElement('style');
  style.textContent = pauseOverlayCss();
  root.appendChild(style);

  const card = document.createElement('div');
  card.style.cssText = cardStyle();

  const title = document.createElement('h2');
  title.textContent = 'Пауза';
  title.style.cssText = titleStyle();
  card.appendChild(title);

  const resumeButton = document.createElement('button');
  resumeButton.className = 'pause-comic-button';
  resumeButton.type = 'button';
  resumeButton.textContent = 'Продолжить';
  resumeButton.style.cssText = primaryButtonStyle();
  resumeButton.addEventListener('click', () => init.onResume());
  card.appendChild(resumeButton);

  const settingsButton = document.createElement('button');
  settingsButton.className = 'pause-comic-button';
  settingsButton.type = 'button';
  settingsButton.textContent = 'Настройки';
  settingsButton.style.cssText = secondaryButtonStyle();
  settingsButton.addEventListener('click', () => init.onOpenSettings());
  card.appendChild(settingsButton);

  const exitButton = document.createElement('button');
  exitButton.className = 'pause-comic-button';
  exitButton.type = 'button';
  exitButton.textContent = 'Выйти в меню';
  exitButton.style.cssText = secondaryButtonStyle();
  exitButton.addEventListener('click', () => init.onExit());
  card.appendChild(exitButton);

  root.appendChild(card);
  init.parent.appendChild(root);
  root.style.display = 'none';

  let visible = false;

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

function baseOverlayStyle(): string {
  return [
    'position:fixed',
    'inset:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-sizing:border-box',
    'padding:24px',
    'background:rgba(255,255,255,0.34)',
    'z-index:90',
    'cursor:default'
  ].join(';');
}

function cardStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:18px',
    'box-sizing:border-box',
    'padding:26px 34px 30px',
    'width:min(380px, calc(100vw - 48px))',
    'background:#fffdf4',
    'border:4px solid #050505',
    'border-radius:8px',
    'box-shadow:8px 8px 0 #000000'
  ].join(';');
}

function titleStyle(): string {
  return [
    'margin:0',
    ...comicTextStyle({
      fontSize: '26px',
      color: '#fff38b',
      lineHeight: '1',
      textAlign: 'center',
      shadow: 'strong'
    })
  ].join(';');
}

function primaryButtonStyle(): string {
  return [
    'appearance:none',
    'border:3px solid #050505',
    'padding:11px 24px 12px',
    ...comicTextStyle({
      fontSize: '18px',
      color: '#ffffff',
      lineHeight: '1'
    }),
    'background:#7cf58f',
    'border-radius:7px',
    'box-shadow:4px 4px 0 #000000',
    'cursor:pointer',
    'width:100%',
    'min-height:46px'
  ].join(';');
}

function secondaryButtonStyle(): string {
  return [
    'appearance:none',
    'border:3px solid #050505',
    'padding:11px 24px 12px',
    ...comicTextStyle({
      fontSize: '18px',
      color: '#ffffff',
      lineHeight: '1'
    }),
    'background:#b8f1ff',
    'border-radius:7px',
    'box-shadow:4px 4px 0 #000000',
    'cursor:pointer',
    'width:100%',
    'min-height:46px'
  ].join(';');
}

function pauseOverlayCss(): string {
  return `
.pause-comic-button {
  transition: filter 120ms ease, transform 120ms ease;
}

.pause-comic-button:hover,
.pause-comic-button:focus-visible {
  filter: brightness(1.08) saturate(1.06);
  transform: translate(-1px, -1px);
}

@media (prefers-reduced-motion: reduce) {
  .pause-comic-button {
    transition: none;
  }

  .pause-comic-button:hover,
  .pause-comic-button:focus-visible {
    transform: none;
  }
}
`;
}
