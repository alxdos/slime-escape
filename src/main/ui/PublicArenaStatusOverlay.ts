import { comicTextStyle } from './comicTextStyle';

export type PublicArenaStatusOverlayInit = Readonly<{
  parent: HTMLElement;
  onBack(): void;
}>;

export type PublicArenaStatusOverlay = Readonly<{
  show(message: string): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}>;

export function createPublicArenaStatusOverlay(
  init: PublicArenaStatusOverlayInit
): PublicArenaStatusOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'public-arena-status-overlay';
  root.style.cssText = rootStyle();

  const message = document.createElement('div');
  message.dataset['role'] = 'public-arena-status-message';
  message.style.cssText = messageStyle();
  root.appendChild(message);

  const back = document.createElement('button');
  back.type = 'button';
  back.dataset['role'] = 'public-arena-back';
  back.textContent = 'Back';
  back.style.cssText = backButtonStyle();
  back.addEventListener('click', init.onBack);
  root.appendChild(back);

  init.parent.appendChild(root);

  let visible = false;
  root.style.display = 'none';

  return {
    show(nextMessage): void {
      visible = true;
      message.textContent = nextMessage;
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
    'z-index:95',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'flex-direction:column',
    'gap:22px',
    'box-sizing:border-box',
    'padding:24px',
    'background:#050505',
    'pointer-events:auto'
  ].join(';');
}

function messageStyle(): string {
  return [
    'max-width:min(720px, 88vw)',
    ...comicTextStyle({
      fontSize: '34px',
      color: '#fff38b',
      lineHeight: '1.05',
      textAlign: 'center'
    }),
    'font-size:min(34px, 8vw)',
    'overflow-wrap:anywhere'
  ].join(';');
}

function backButtonStyle(): string {
  return [
    'appearance:none',
    'min-width:128px',
    'box-sizing:border-box',
    'padding:10px 18px 12px',
    'border:4px solid #050505',
    'border-radius:8px',
    'background:#fffdf4',
    'box-shadow:5px 5px 0 #000000',
    'cursor:pointer',
    ...comicTextStyle({
      fontSize: '22px',
      color: '#ffffff',
      lineHeight: '1',
      textAlign: 'center'
    })
  ].join(';');
}
