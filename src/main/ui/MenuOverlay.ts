export type MenuOverlayInit = Readonly<{
  parent: HTMLElement;
  onStart(): void;
}>;

export type MenuResult = 'win' | 'loss' | null;

export type MenuOverlay = Readonly<{
  show(): void;
  hide(): void;
  isVisible(): boolean;
  setResult(result: MenuResult): void;
  dispose(): void;
}>;

export function createMenuOverlay(init: MenuOverlayInit): MenuOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'menu-overlay';
  root.style.cssText = baseOverlayStyle();

  const card = document.createElement('div');
  card.style.cssText = cardStyle();

  const result = document.createElement('div');
  result.style.cssText = resultStyle();
  result.style.display = 'none';
  card.appendChild(result);

  const title = document.createElement('h1');
  title.textContent = 'Slime Escape';
  title.style.cssText = titleStyle();
  card.appendChild(title);

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.textContent = 'Старт';
  startButton.style.cssText = primaryButtonStyle();
  startButton.addEventListener('click', () => init.onStart());
  card.appendChild(startButton);

  root.appendChild(card);
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
    setResult(next): void {
      if (next === null) {
        result.style.display = 'none';
        result.textContent = '';
        return;
      }
      result.style.display = 'block';
      if (next === 'win') {
        result.textContent = 'Победа!';
        result.style.color = '#9ce69a';
      } else {
        result.textContent = 'Поражение';
        result.style.color = '#ff8a7a';
      }
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
    'background:rgba(5,6,10,0.85)',
    'z-index:100',
    'cursor:default'
  ].join(';');
}

function cardStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:24px',
    'padding:32px 40px',
    'background:#11151c',
    'border:1px solid #2a3142',
    'border-radius:8px',
    'box-shadow:0 12px 40px rgba(0,0,0,0.6)'
  ].join(';');
}

function resultStyle(): string {
  return [
    'margin:0',
    'font-size:18px',
    'font-weight:600',
    'letter-spacing:0.08em',
    'text-transform:uppercase'
  ].join(';');
}

function titleStyle(): string {
  return [
    'margin:0',
    'font-size:28px',
    'font-weight:600',
    'color:#e6e8ef',
    'letter-spacing:0.04em'
  ].join(';');
}

function primaryButtonStyle(): string {
  return [
    'appearance:none',
    'border:none',
    'padding:12px 32px',
    'font-size:16px',
    'font-weight:600',
    'letter-spacing:0.04em',
    'color:#0a0c10',
    'background:#9ad6ff',
    'border-radius:4px',
    'cursor:pointer'
  ].join(';');
}
