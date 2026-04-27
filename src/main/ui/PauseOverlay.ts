import { assertNever } from '../../shared/protocol';

import type {
  EscapeProgressPathPointViewModel,
  EscapeProgressPathViewModel
} from './EscapeProgressPathViewModel';
import { comicTextStyle } from './comicTextStyle';

export type PauseOverlayInit = Readonly<{
  parent: HTMLElement;
  onResume(): void;
  onExit(): void;
  onOpenSettings(): void;
}>;

export type PauseOverlay = Readonly<{
  setEscapePath(viewModel: EscapeProgressPathViewModel): void;
  show(): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}>;

const HIDDEN_ESCAPE_PATH: EscapeProgressPathViewModel = Object.freeze({ kind: 'hidden' });

export function createPauseOverlay(init: PauseOverlayInit): PauseOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'pause-overlay';
  root.style.cssText = baseOverlayStyle();

  const style = document.createElement('style');
  style.textContent = pauseOverlayCss();
  root.appendChild(style);

  const card = document.createElement('div');
  card.dataset['role'] = 'pause-card';
  card.style.cssText = cardStyle();

  const title = document.createElement('h2');
  title.textContent = 'Paused';
  title.style.cssText = titleStyle();
  card.appendChild(title);

  const escapePath = document.createElement('section');
  escapePath.dataset['role'] = 'pause-escape-path';
  escapePath.style.cssText = pauseEscapePathStyle();
  card.appendChild(escapePath);
  renderEscapePath(escapePath, HIDDEN_ESCAPE_PATH);

  const resumeButton = document.createElement('button');
  resumeButton.className = 'pause-comic-button';
  resumeButton.type = 'button';
  resumeButton.textContent = 'Resume';
  resumeButton.style.cssText = primaryButtonStyle();
  resumeButton.addEventListener('click', () => init.onResume());
  card.appendChild(resumeButton);

  const settingsButton = document.createElement('button');
  settingsButton.className = 'pause-comic-button';
  settingsButton.type = 'button';
  settingsButton.textContent = 'Settings';
  settingsButton.style.cssText = secondaryButtonStyle();
  settingsButton.addEventListener('click', () => init.onOpenSettings());
  card.appendChild(settingsButton);

  const exitButton = document.createElement('button');
  exitButton.className = 'pause-comic-button';
  exitButton.type = 'button';
  exitButton.textContent = 'Exit to Menu';
  exitButton.style.cssText = secondaryButtonStyle();
  exitButton.addEventListener('click', () => init.onExit());
  card.appendChild(exitButton);

  root.appendChild(card);
  init.parent.appendChild(root);
  root.style.display = 'none';

  let visible = false;
  let escapePathRenderSignature: string | null = null;

  function applyEscapePath(viewModel: EscapeProgressPathViewModel): void {
    const nextSignature = escapePathSignature(viewModel);
    if (escapePathRenderSignature === nextSignature) {
      return;
    }
    escapePathRenderSignature = nextSignature;
    renderEscapePath(escapePath, viewModel);
  }

  return {
    setEscapePath(viewModel): void {
      applyEscapePath(viewModel);
    },
    show(): void {
      visible = true;
      root.style.display = 'flex';
    },
    hide(): void {
      visible = false;
      root.style.display = 'none';
      applyEscapePath(HIDDEN_ESCAPE_PATH);
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {
      root.remove();
    }
  };
}

function escapePathSignature(viewModel: EscapeProgressPathViewModel): string {
  if (viewModel.kind === 'hidden') return 'hidden';
  return [
    viewModel.presentation,
    viewModel.totalWaves,
    viewModel.completedWaves,
    viewModel.activeWaveIndex ?? 'none',
    viewModel.stop.kind === 'none' ? 'none' : viewModel.stop.anchor,
    viewModel.flagState,
    ...viewModel.points.map((point) => `${point.index}:${point.state}`)
  ].join('|');
}

function renderEscapePath(container: HTMLElement, viewModel: EscapeProgressPathViewModel): void {
  if (viewModel.kind === 'hidden') {
    container.style.display = 'none';
    container.replaceChildren();
    return;
  }

  container.style.cssText = pauseEscapePathStyle();
  container.style.display = 'grid';
  container.replaceChildren(
    createEscapePathLabel(viewModel),
    createEscapePathTrack(viewModel),
    createEscapePathText(viewModel)
  );
}

function createEscapePathLabel(
  viewModel: Extract<EscapeProgressPathViewModel, { kind: 'path' }>
): HTMLElement {
  const label = document.createElement('div');
  label.dataset['role'] = 'pause-escape-path-label';
  label.textContent = pauseEscapePathLabel(viewModel);
  label.style.cssText = pauseEscapePathLabelStyle();
  return label;
}

function createEscapePathTrack(
  viewModel: Extract<EscapeProgressPathViewModel, { kind: 'path' }>
): HTMLElement {
  const track = document.createElement('div');
  track.dataset['role'] = 'pause-escape-path-track';
  track.style.cssText = pauseEscapePathTrackStyle();
  const nodes = viewModel.points.map((point) => {
    const node = document.createElement('span');
    node.dataset['role'] = 'pause-escape-path-point';
    node.dataset['waveIndex'] = String(point.index);
    node.dataset['state'] = point.state;
    node.setAttribute('aria-label', point.label);
    node.textContent = pointSymbol(point.state);
    node.style.cssText = pauseEscapePathPointStyle(point.state);
    return node;
  });

  const flag = document.createElement('span');
  flag.dataset['role'] = 'pause-escape-path-flag';
  flag.dataset['state'] = viewModel.flagState;
  flag.setAttribute('aria-label', 'Exit flag');
  flag.textContent = '🏁';
  flag.style.cssText = pauseEscapePathFlagStyle(viewModel.flagState);
  track.replaceChildren(...nodes, flag);
  return track;
}

function createEscapePathText(
  viewModel: Extract<EscapeProgressPathViewModel, { kind: 'path' }>
): HTMLElement {
  const text = document.createElement('div');
  text.dataset['role'] = 'pause-escape-path-text';
  text.textContent = pauseEscapePathText(viewModel);
  text.style.cssText = pauseEscapePathTextStyle();
  return text;
}

function pauseEscapePathLabel(
  viewModel: Extract<EscapeProgressPathViewModel, { kind: 'path' }>
): string {
  if (viewModel.activeWaveIndex !== null) {
    return `Wave ${viewModel.activeWaveIndex}/${viewModel.totalWaves}`;
  }
  if (viewModel.completedWaves > 0) {
    return `Wave ${viewModel.completedWaves} cleared`;
  }
  return 'Escape Map';
}

function pauseEscapePathText(
  viewModel: Extract<EscapeProgressPathViewModel, { kind: 'path' }>
): string {
  const remaining = Math.max(0, viewModel.totalWaves - viewModel.completedWaves);
  return remaining === 0 ? 'Exit is close' : `Exit in ${formatWaveCount(remaining)}`;
}

function pointSymbol(state: EscapeProgressPathPointViewModel['state']): string {
  switch (state) {
    case 'completed':
      return '●';
    case 'active':
      return '◉';
    case 'stopped':
      return '✕';
    case 'upcoming':
      return '○';
    default:
      return assertNever(state);
  }
}

function formatWaveCount(count: number): string {
  const remainder10 = count % 10;
  const remainder100 = count % 100;
  const noun =
    remainder10 === 1 && remainder100 !== 11
      ? 'wave'
      : remainder10 >= 2 && remainder10 <= 4 && (remainder100 < 12 || remainder100 > 14)
        ? 'waves'
        : 'waves';
  return `${count} ${noun}`;
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
    'overflow:auto',
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
    'gap:16px',
    'box-sizing:border-box',
    'padding:26px 30px 30px',
    'width:min(640px, calc(100vw - 48px))',
    'max-height:calc(100vh - 48px)',
    'overflow:auto',
    'background:#fffdf4',
    'border:4px solid #050505',
    'border-radius:8px',
    'box-shadow:8px 8px 0 #000000'
  ].join(';');
}

function pauseEscapePathStyle(): string {
  return [
    'display:none',
    'box-sizing:border-box',
    'width:100%',
    'gap:8px',
    'justify-items:center',
    'padding:9px 8px 11px',
    'background:rgba(124,245,143,0.16)',
    'border-radius:8px'
  ].join(';');
}

function pauseEscapePathLabelStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '17px',
      color: '#fff38b',
      lineHeight: '1',
      textAlign: 'center',
      shadow: 'strong'
    }),
    'font-variant-numeric:tabular-nums',
    'font-feature-settings:"tnum"',
    'overflow-wrap:anywhere'
  ].join(';');
}

function pauseEscapePathTrackStyle(): string {
  return [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'gap:7px',
    'max-width:100%',
    'overflow:hidden',
    'white-space:nowrap'
  ].join(';');
}

function pauseEscapePathTextStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '15px',
      color: '#ffffff',
      lineHeight: '1.12',
      textAlign: 'center'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function pauseEscapePathPointStyle(state: EscapeProgressPathPointViewModel['state']): string {
  const color =
    state === 'active'
      ? '#ffd166'
      : state === 'upcoming'
        ? '#7d8795'
        : state === 'stopped'
          ? '#ff5c7e'
          : '#1fbf77';
  const glow =
    state === 'active'
      ? '0 0 9px rgba(255,209,102,0.78)'
      : state === 'stopped'
        ? '0 0 8px rgba(255,92,126,0.65)'
        : state === 'completed'
          ? '0 0 7px rgba(31,191,119,0.46)'
          : 'none';
  return [
    'display:inline-grid',
    'place-items:center',
    'width:16px',
    'height:16px',
    ...comicTextStyle({
      fontSize: '17px',
      color,
      lineHeight: '1'
    }),
    `text-shadow:${glow}`,
    state === 'upcoming' ? 'opacity:0.6' : 'opacity:1'
  ].join(';');
}

function pauseEscapePathFlagStyle(flagState: 'pending' | 'reached'): string {
  return [
    'display:inline-grid',
    'place-items:center',
    'width:20px',
    'height:20px',
    'font-size:18px',
    'line-height:1',
    flagState === 'reached'
      ? 'filter:drop-shadow(0 0 8px rgba(31,191,119,0.72))'
      : 'opacity:0.76'
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
    'max-width:380px',
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
    'max-width:380px',
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
