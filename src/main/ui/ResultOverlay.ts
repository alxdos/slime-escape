export type ResultOutcome = 'win' | 'loss';

export type ResultOverlayInit = Readonly<{
  parent: HTMLElement;
  onBackToMenu(): void;
}>;

export type ResultOverlay = Readonly<{
  show(outcome: ResultOutcome): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}>;

export function createResultOverlay(init: ResultOverlayInit): ResultOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'result-overlay';
  root.style.cssText = baseOverlayStyle();

  const card = document.createElement('div');
  card.style.cssText = cardStyle();

  const title = document.createElement('h2');
  title.style.cssText = titleStyle();
  card.appendChild(title);

  const summary = document.createElement('p');
  summary.style.cssText = summaryStyle();
  card.appendChild(summary);

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.textContent = 'В меню';
  backButton.style.cssText = primaryButtonStyle();
  backButton.addEventListener('click', () => init.onBackToMenu());
  card.appendChild(backButton);

  root.appendChild(card);
  init.parent.appendChild(root);
  root.style.display = 'none';

  let visible = false;

  return {
    show(outcome): void {
      visible = true;
      applyOutcome(outcome, title, summary);
      root.style.display = 'flex';
    },
    hide(): void {
      visible = false;
      root.style.display = 'none';
      title.textContent = '';
      summary.textContent = '';
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {
      root.remove();
    }
  };
}

function applyOutcome(
  outcome: ResultOutcome,
  title: HTMLElement,
  summary: HTMLElement
): void {
  if (outcome === 'win') {
    title.textContent = 'Победа!';
    title.style.color = '#9ce69a';
    summary.textContent = 'Забег завершён успешно.';
    return;
  }

  title.textContent = 'Поражение';
  title.style.color = '#ff8a7a';
  summary.textContent = 'Попробуй ещё раз из меню.';
}

function baseOverlayStyle(): string {
  return [
    'position:fixed',
    'inset:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:rgba(5,6,10,0.88)',
    'z-index:110',
    'cursor:default'
  ].join(';');
}

function cardStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:16px',
    'padding:32px 40px',
    'min-width:min(420px, calc(100vw - 48px))',
    'background:#11151c',
    'border:1px solid #2a3142',
    'border-radius:8px',
    'box-shadow:0 12px 40px rgba(0,0,0,0.6)'
  ].join(';');
}

function titleStyle(): string {
  return [
    'margin:0',
    'font-size:28px',
    'font-weight:700',
    'letter-spacing:0.06em',
    'text-transform:uppercase'
  ].join(';');
}

function summaryStyle(): string {
  return [
    'margin:0',
    'font-size:15px',
    'line-height:1.5',
    'color:#cdd5e3',
    'text-align:center'
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
