export type StartupErrorOverlayInit = Readonly<{
  parent: HTMLElement;
  onReload(): void;
}>;

export type StartupErrorOverlay = Readonly<{
  show(message: string): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}>;

export function createStartupErrorOverlay(init: StartupErrorOverlayInit): StartupErrorOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'startup-error-overlay';
  root.style.cssText = rootStyle();

  const card = document.createElement('div');
  card.style.cssText = cardStyle();

  const title = document.createElement('h2');
  title.textContent = 'Ошибка загрузки';
  title.style.cssText = titleStyle();
  card.appendChild(title);

  const body = document.createElement('p');
  body.dataset['role'] = 'startup-error-message';
  body.style.cssText = bodyStyle();
  card.appendChild(body);

  const reloadButton = document.createElement('button');
  reloadButton.type = 'button';
  reloadButton.textContent = 'Перезагрузить страницу';
  reloadButton.style.cssText = buttonStyle();
  reloadButton.addEventListener('click', () => init.onReload());
  card.appendChild(reloadButton);

  root.appendChild(card);
  init.parent.appendChild(root);
  root.style.display = 'none';

  let visible = false;

  return {
    show(message): void {
      visible = true;
      body.textContent = message;
      root.style.display = 'flex';
    },
    hide(): void {
      visible = false;
      body.textContent = '';
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
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:32px',
    'background:rgba(15,23,42,0.92)',
    'z-index:130'
  ].join(';');
}

function cardStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'gap:18px',
    'width:min(520px, calc(100vw - 64px))',
    'padding:28px 32px',
    'background:#101828',
    'border:1px solid rgba(248,113,113,0.28)',
    'border-radius:12px',
    'box-shadow:0 24px 64px rgba(0,0,0,0.45)'
  ].join(';');
}

function titleStyle(): string {
  return [
    'margin:0',
    'font-size:24px',
    'font-weight:700',
    'color:#fda29b'
  ].join(';');
}

function bodyStyle(): string {
  return [
    'margin:0',
    'font-size:15px',
    'line-height:1.6',
    'color:#f8fafc'
  ].join(';');
}

function buttonStyle(): string {
  return [
    'appearance:none',
    'border:none',
    'padding:12px 20px',
    'font-size:15px',
    'font-weight:600',
    'color:#101828',
    'background:#fda29b',
    'border-radius:6px',
    'cursor:pointer',
    'align-self:flex-start'
  ].join(';');
}
