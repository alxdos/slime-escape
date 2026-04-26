import { comicTextStyle } from './comicTextStyle';
import type { ResultViewModel } from './ResultViewModel';

export type ResultOutcome = 'win' | 'loss';

export type ResultOverlayInit = Readonly<{
  parent: HTMLElement;
  onBackToMenu(): void;
}>;

export type ResultOverlay = Readonly<{
  show(viewModel: ResultViewModel): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}>;

export function createResultOverlay(init: ResultOverlayInit): ResultOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'result-overlay';
  root.style.cssText = baseOverlayStyle();

  const style = document.createElement('style');
  style.textContent = resultOverlayCss();
  root.appendChild(style);

  const card = document.createElement('div');
  card.style.cssText = cardStyle();

  const title = document.createElement('h2');
  title.dataset['role'] = 'result-title';
  title.style.cssText = titleStyle();
  card.appendChild(title);

  const summary = document.createElement('p');
  summary.dataset['role'] = 'result-summary';
  summary.style.cssText = summaryStyle();
  card.appendChild(summary);

  const backButton = document.createElement('button');
  backButton.dataset['role'] = 'result-back-to-menu';
  backButton.className = 'result-comic-button';
  backButton.type = 'button';
  backButton.textContent = 'Вернуться в меню';
  backButton.style.cssText = primaryButtonStyle();
  backButton.addEventListener('click', () => init.onBackToMenu());
  card.appendChild(backButton);

  root.appendChild(card);
  init.parent.appendChild(root);
  root.style.display = 'none';

  let visible = false;

  return {
    show(viewModel): void {
      visible = true;
      applyViewModel(viewModel, root, title, summary, backButton);
      root.style.display = 'flex';
    },
    hide(): void {
      visible = false;
      delete root.dataset['outcome'];
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

function applyViewModel(
  viewModel: ResultViewModel,
  root: HTMLElement,
  title: HTMLElement,
  summary: HTMLElement,
  backButton: HTMLElement
): void {
  const outcome = viewModel.outcome;
  root.dataset['outcome'] = outcome;

  if (outcome === 'win') {
    title.textContent = viewModel.title;
    title.style.cssText = titleStyle('#fff38b');
    summary.textContent = viewModel.subtitle;
    summary.style.cssText = summaryStyle('#e9fbff');
    backButton.style.cssText = primaryButtonStyle('#7cf58f');
    return;
  }

  title.textContent = viewModel.title;
  title.style.cssText = titleStyle('#ff9fcf');
  summary.textContent = viewModel.subtitle;
  summary.style.cssText = summaryStyle('#ffe7f3');
  backButton.style.cssText = primaryButtonStyle('#ff9fcf');
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
    'background:rgba(255,255,255,0.42)',
    'z-index:110',
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
    'width:min(460px, calc(100vw - 48px))',
    'background:#fffdf4',
    'border:4px solid #050505',
    'border-radius:8px',
    'box-shadow:8px 8px 0 #000000'
  ].join(';');
}

function titleStyle(color = '#fff38b'): string {
  return [
    'margin:0',
    ...comicTextStyle({
      fontSize: '30px',
      lineHeight: '1',
      color,
      textAlign: 'center',
      shadow: 'strong'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function summaryStyle(background = '#e9fbff'): string {
  return [
    'margin:0',
    'box-sizing:border-box',
    'width:100%',
    'padding:14px 16px 16px',
    `background:${background}`,
    'border:3px solid #050505',
    'border-radius:8px',
    'box-shadow:4px 4px 0 #000000',
    ...comicTextStyle({
      fontSize: '17px',
      color: '#ffffff',
      lineHeight: '1.25',
      textAlign: 'center'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function primaryButtonStyle(background = '#7cf58f'): string {
  return [
    'appearance:none',
    'border:3px solid #050505',
    'padding:11px 24px 12px',
    ...comicTextStyle({
      fontSize: '18px',
      color: '#ffffff',
      lineHeight: '1'
    }),
    `background:${background}`,
    'border-radius:7px',
    'box-shadow:4px 4px 0 #000000',
    'cursor:pointer',
    'width:100%',
    'min-height:46px'
  ].join(';');
}

function resultOverlayCss(): string {
  return `
.result-comic-button {
  transition: filter 120ms ease, transform 120ms ease;
}

.result-comic-button:hover,
.result-comic-button:focus-visible {
  filter: brightness(1.08) saturate(1.06);
  transform: translate(-1px, -1px);
}

@media (prefers-reduced-motion: reduce) {
  .result-comic-button {
    transition: none;
  }

  .result-comic-button:hover,
  .result-comic-button:focus-visible {
    transform: none;
  }
}
`;
}
