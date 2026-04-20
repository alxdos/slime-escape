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

  const card = document.createElement('div');
  card.style.cssText = cardStyle();

  const title = document.createElement('h2');
  title.textContent = 'Пауза';
  title.style.cssText = titleStyle();
  card.appendChild(title);

  const resumeButton = document.createElement('button');
  resumeButton.type = 'button';
  resumeButton.textContent = 'Продолжить';
  resumeButton.style.cssText = primaryButtonStyle();
  resumeButton.addEventListener('click', () => init.onResume());
  card.appendChild(resumeButton);

  const settingsButton = document.createElement('button');
  settingsButton.type = 'button';
  settingsButton.textContent = 'Настройки';
  settingsButton.style.cssText = secondaryButtonStyle();
  settingsButton.addEventListener('click', () => init.onOpenSettings());
  card.appendChild(settingsButton);

  const exitButton = document.createElement('button');
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
    'background:rgba(5,6,10,0.7)',
    'z-index:90',
    'cursor:default'
  ].join(';');
}

function cardStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:16px',
    'padding:28px 36px',
    'background:#11151c',
    'border:1px solid #2a3142',
    'border-radius:8px',
    'box-shadow:0 12px 40px rgba(0,0,0,0.6)'
  ].join(';');
}

function titleStyle(): string {
  return [
    'margin:0',
    'font-size:22px',
    'font-weight:600',
    'color:#e6e8ef',
    'letter-spacing:0.04em'
  ].join(';');
}

function primaryButtonStyle(): string {
  return [
    'appearance:none',
    'border:none',
    'padding:10px 28px',
    'font-size:15px',
    'font-weight:600',
    'letter-spacing:0.04em',
    'color:#0a0c10',
    'background:#9ad6ff',
    'border-radius:4px',
    'cursor:pointer',
    'min-width:200px'
  ].join(';');
}

function secondaryButtonStyle(): string {
  return [
    'appearance:none',
    'padding:10px 28px',
    'font-size:15px',
    'font-weight:500',
    'letter-spacing:0.04em',
    'color:#cdd5e3',
    'background:transparent',
    'border:1px solid #2a3142',
    'border-radius:4px',
    'cursor:pointer',
    'min-width:200px'
  ].join(';');
}
