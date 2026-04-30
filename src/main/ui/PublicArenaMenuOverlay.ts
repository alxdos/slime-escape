import { comicTextStyle } from './comicTextStyle';

export type PublicArenaMenuOverlayInit = Readonly<{
  parent: HTMLElement;
  onResume(): void;
  onExit(): void;
}>;

export type PublicArenaMenuOverlay = Readonly<{
  show(): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}>;

export function createPublicArenaMenuOverlay(
  init: PublicArenaMenuOverlayInit
): PublicArenaMenuOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'public-arena-menu-overlay';
  root.style.cssText = rootStyle();

  const card = document.createElement('div');
  card.dataset['role'] = 'public-arena-menu-card';
  card.style.cssText = cardStyle();

  const title = document.createElement('h2');
  title.textContent = 'Public Arena';
  title.style.cssText = titleStyle();
  card.appendChild(title);

  const resumeButton = document.createElement('button');
  resumeButton.type = 'button';
  resumeButton.dataset['role'] = 'public-arena-menu-resume';
  resumeButton.textContent = 'Resume';
  resumeButton.style.cssText = primaryButtonStyle();
  resumeButton.addEventListener('click', init.onResume);
  card.appendChild(resumeButton);

  const exitButton = document.createElement('button');
  exitButton.type = 'button';
  exitButton.dataset['role'] = 'public-arena-menu-exit';
  exitButton.textContent = 'Exit Arena';
  exitButton.style.cssText = secondaryButtonStyle();
  exitButton.addEventListener('click', init.onExit);
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

function rootStyle(): string {
  return [
    'position:fixed',
    'inset:0',
    'z-index:88',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'box-sizing:border-box',
    'padding:24px',
    'background:rgba(4, 5, 8, 0.74)',
    'pointer-events:auto'
  ].join(';');
}

function cardStyle(): string {
  return [
    'display:grid',
    'gap:16px',
    'min-width:min(320px, 88vw)',
    'box-sizing:border-box',
    'padding:22px',
    'border:4px solid #050505',
    'border-radius:8px',
    'background:#fffdf4',
    'box-shadow:8px 8px 0 #000000'
  ].join(';');
}

function titleStyle(): string {
  return [
    'margin:0 0 2px',
    ...comicTextStyle({
      fontSize: '32px',
      color: '#111111',
      lineHeight: '1',
      textAlign: 'center'
    })
  ].join(';');
}

function primaryButtonStyle(): string {
  return buttonStyle('#72f2ff');
}

function secondaryButtonStyle(): string {
  return buttonStyle('#ffd166');
}

function buttonStyle(background: string): string {
  return [
    'appearance:none',
    'box-sizing:border-box',
    'padding:10px 16px 12px',
    'border:4px solid #050505',
    'border-radius:8px',
    `background:${background}`,
    'box-shadow:4px 4px 0 #000000',
    'cursor:pointer',
    ...comicTextStyle({
      fontSize: '22px',
      color: '#111111',
      lineHeight: '1',
      textAlign: 'center'
    })
  ].join(';');
}
