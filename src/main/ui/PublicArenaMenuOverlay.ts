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
    'background:rgba(255,255,255,0.34)',
    'pointer-events:auto'
  ].join(';');
}

function cardStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:16px',
    'width:min(420px, calc(100vw - 48px))',
    'box-sizing:border-box',
    'padding:26px 30px 30px',
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
      fontSize: '26px',
      color: '#fff38b',
      lineHeight: '1',
      textAlign: 'center',
      shadow: 'strong'
    })
  ].join(';');
}

function primaryButtonStyle(): string {
  return buttonStyle('#7cf58f');
}

function secondaryButtonStyle(): string {
  return buttonStyle('#b8f1ff');
}

function buttonStyle(background: string): string {
  return [
    'appearance:none',
    'box-sizing:border-box',
    'padding:11px 24px 12px',
    'border:3px solid #050505',
    'border-radius:7px',
    `background:${background}`,
    'box-shadow:4px 4px 0 #000000',
    'cursor:pointer',
    'width:100%',
    'max-width:380px',
    'min-height:46px',
    ...comicTextStyle({
      fontSize: '18px',
      color: '#ffffff',
      lineHeight: '1',
      textAlign: 'center'
    })
  ].join(';');
}
