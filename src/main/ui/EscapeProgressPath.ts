import type { SessionDefinition } from '../../shared/session';
import { assertNever } from '../../shared/protocol';
import type { SnapshotPair } from '../sim/SimWorkerHost';

import {
  deriveLiveEscapeProgressPathViewModel,
  type EscapeProgressPathPointViewModel,
  type EscapeProgressPathViewModel
} from './EscapeProgressPathViewModel';
import type { UiShellPhase } from './UiShellPhase';
import { GAME_VIEWPORT_WIDTH } from './gameViewportCss';
import { COMIC_TEXT_FONT_FAMILY, comicTextStyle } from './comicTextStyle';

export type EscapeProgressPathInit = Readonly<{
  parent: HTMLElement;
}>;

export type EscapeProgressPath = Readonly<{
  attach(session: SessionDefinition): void;
  update(snapshotPair: SnapshotPair, phase: UiShellPhase): void;
  detach(): void;
  dispose(): void;
}>;

const HIDDEN_VIEW_MODEL: EscapeProgressPathViewModel = Object.freeze({ kind: 'hidden' });

export function createEscapeProgressPath(init: EscapeProgressPathInit): EscapeProgressPath {
  const root = document.createElement('section');
  root.className = 'escape-progress-path';
  root.dataset['role'] = 'escape-progress-path';
  root.style.cssText = rootStyle();
  root.style.display = 'none';

  const style = document.createElement('style');
  style.textContent = escapeProgressPathCss();
  root.appendChild(style);

  const label = document.createElement('div');
  label.dataset['role'] = 'escape-progress-label';
  root.appendChild(label);

  const track = document.createElement('div');
  track.dataset['role'] = 'escape-progress-track';
  root.appendChild(track);

  const footer = document.createElement('div');
  footer.dataset['role'] = 'escape-progress-footer';
  root.appendChild(footer);

  init.parent.appendChild(root);

  let session: SessionDefinition | null = null;
  let lastVisibleViewModel: EscapeProgressPathViewModel = HIDDEN_VIEW_MODEL;
  let renderSignature: string | null = null;

  return {
    attach(nextSession): void {
      session = nextSession;
      lastVisibleViewModel = HIDDEN_VIEW_MODEL;
      renderSignature = null;
      render(root, label, track, footer, HIDDEN_VIEW_MODEL);
    },
    update(snapshotPair, phase): void {
      if (session === null) return;
      if (phase.kind === 'paused') {
        render(root, label, track, footer, lastVisibleViewModel);
        return;
      }
      if (phase.kind !== 'running') {
        lastVisibleViewModel = HIDDEN_VIEW_MODEL;
        render(root, label, track, footer, HIDDEN_VIEW_MODEL);
        return;
      }

      const viewModel = deriveLiveEscapeProgressPathViewModel(session, snapshotPair.curr);
      lastVisibleViewModel = viewModel;
      render(root, label, track, footer, viewModel);
    },
    detach(): void {
      session = null;
      lastVisibleViewModel = HIDDEN_VIEW_MODEL;
      renderSignature = null;
      render(root, label, track, footer, HIDDEN_VIEW_MODEL);
    },
    dispose(): void {
      root.remove();
    }
  };

  function render(
    rootElement: HTMLElement,
    labelElement: HTMLElement,
    trackElement: HTMLElement,
    footerElement: HTMLElement,
    viewModel: EscapeProgressPathViewModel
  ): void {
    const nextSignature = viewModelSignature(viewModel);
    if (renderSignature === nextSignature) {
      return;
    }
    renderSignature = nextSignature;

    if (viewModel.kind === 'hidden') {
      rootElement.style.display = 'none';
      labelElement.textContent = '';
      footerElement.textContent = '';
      trackElement.replaceChildren();
      return;
    }

    rootElement.dataset['presentation'] = viewModel.presentation;
    rootElement.style.cssText =
      viewModel.presentation === 'expandedBreak' ? expandedRootStyle() : compactRootStyle();
    rootElement.style.display = 'grid';
    labelElement.style.cssText =
      viewModel.presentation === 'expandedBreak' ? expandedLabelStyle() : compactLabelStyle();
    trackElement.style.cssText =
      viewModel.presentation === 'expandedBreak' ? expandedTrackStyle() : compactTrackStyle();
    footerElement.style.cssText =
      viewModel.presentation === 'expandedBreak' ? expandedFooterStyle() : compactFooterStyle();

    labelElement.textContent = labelText(viewModel);
    footerElement.textContent = footerText(viewModel);
    trackElement.replaceChildren(...createTrackNodes(viewModel.points, viewModel.flagState));
  }
}

function createTrackNodes(
  points: ReadonlyArray<EscapeProgressPathPointViewModel>,
  flagState: 'pending' | 'reached'
): HTMLElement[] {
  const nodes = points.map((point) => {
    const node = document.createElement('span');
    node.className = 'escape-progress-point';
    node.dataset['waveIndex'] = String(point.index);
    node.dataset['state'] = point.state;
    node.setAttribute('aria-label', point.label);
    node.textContent = pointSymbol(point.state);
    node.style.cssText = pointStyle(point.state);
    return node;
  });

  const flag = document.createElement('span');
  flag.className = 'escape-progress-flag';
  flag.dataset['role'] = 'escape-progress-flag';
  flag.dataset['state'] = flagState;
  flag.setAttribute('aria-label', 'Exit flag');
  flag.textContent = '🏁';
  flag.style.cssText = flagStyle(flagState);
  nodes.push(flag);
  return nodes;
}

function labelText(viewModel: Extract<EscapeProgressPathViewModel, { kind: 'path' }>): string {
  if (viewModel.presentation === 'expandedBreak') {
    return viewModel.completedWaves > 0
      ? `Wave ${viewModel.completedWaves} cleared`
      : 'Escape Map';
  }
  const current = viewModel.activeWaveIndex ?? viewModel.completedWaves;
  return `Wave ${current}/${viewModel.totalWaves}`;
}

function footerText(viewModel: Extract<EscapeProgressPathViewModel, { kind: 'path' }>): string {
  if (viewModel.presentation !== 'expandedBreak') {
    return '';
  }
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

function viewModelSignature(viewModel: EscapeProgressPathViewModel): string {
  if (viewModel.kind === 'hidden') return 'hidden';
  return [
    viewModel.presentation,
    viewModel.completedWaves,
    viewModel.activeWaveIndex ?? 'none',
    viewModel.stop.kind === 'none' ? 'none' : viewModel.stop.anchor,
    viewModel.flagState,
    ...viewModel.points.map((point) => `${point.index}:${point.state}`)
  ].join('|');
}

function rootStyle(): string {
  return [
    'position:fixed',
    'display:none',
    'pointer-events:none',
    `font-family:${COMIC_TEXT_FONT_FAMILY}`,
    'color:#f7fbff',
    'z-index:45'
  ].join(';');
}

function compactRootStyle(): string {
  return [
    rootStyle(),
    'top:30px',
    'right:56px',
    'grid-template-columns:max-content 1fr',
    'align-items:center',
    'gap:7px 10px',
    'max-width:min(62%, 620px)',
    'padding:4px 0',
    'text-align:right'
  ].join(';');
}

function expandedRootStyle(): string {
  return [
    rootStyle(),
    'top:70px',
    'left:50%',
    'transform:translateX(-50%)',
    'grid-template-columns:1fr',
    'justify-items:center',
    'gap:8px',
    `width:min(760px, calc(${GAME_VIEWPORT_WIDTH} - 28px))`,
    'text-align:center'
  ].join(';');
}

function compactLabelStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '17px',
      fontWeight: 900,
      lineHeight: '1',
      color: '#ffffff'
    }),
    'white-space:nowrap',
    'font-variant-numeric:tabular-nums',
    'font-feature-settings:"tnum"'
  ].join(';');
}

function expandedLabelStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '24px',
      fontWeight: 900,
      lineHeight: '1.05',
      color: '#ffffff',
      shadow: 'strong'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function compactTrackStyle(): string {
  return [
    'display:flex',
    'align-items:center',
    'justify-content:flex-end',
    'gap:4px',
    'min-width:0',
    'overflow:hidden',
    'white-space:nowrap'
  ].join(';');
}

function expandedTrackStyle(): string {
  return [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'gap:8px',
    'max-width:100%',
    'overflow:hidden',
    'white-space:nowrap'
  ].join(';');
}

function compactFooterStyle(): string {
  return ['display:none'].join(';');
}

function expandedFooterStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '15px',
      fontWeight: 800,
      lineHeight: '1.1',
      color: '#dbf7ff'
    }),
    'white-space:nowrap'
  ].join(';');
}

function pointStyle(state: EscapeProgressPathPointViewModel['state']): string {
  const color =
    state === 'active'
      ? '#ffd166'
      : state === 'upcoming'
        ? '#9aa7b8'
        : state === 'stopped'
          ? '#ff7b90'
          : '#7dffbd';
  const glow =
    state === 'active'
      ? '0 0 13px rgba(255,209,102,0.82)'
      : state === 'completed'
        ? '0 0 7px rgba(125,255,189,0.56)'
        : state === 'stopped'
          ? '0 0 9px rgba(255,123,144,0.72)'
          : 'none';
  return [
    'display:inline-grid',
    'place-items:center',
    'width:20px',
    'height:20px',
    ...comicTextStyle({
      fontSize: '20px',
      fontWeight: 900,
      lineHeight: '1',
      color
    }),
    '-webkit-text-stroke:1.6px rgba(5,5,5,0.68)',
    'paint-order:stroke fill',
    `text-shadow:${glow}`,
    state === 'upcoming' ? 'opacity:0.62' : 'opacity:1'
  ].join(';');
}

function flagStyle(flagState: 'pending' | 'reached'): string {
  return [
    'display:inline-grid',
    'place-items:center',
    'width:24px',
    'height:24px',
    'font-size:22px',
    'line-height:1',
    flagState === 'reached'
      ? 'filter:drop-shadow(0 0 8px rgba(125,255,189,0.82))'
      : 'opacity:0.86'
  ].join(';');
}

function escapeProgressPathCss(): string {
  return `
@keyframes escape-progress-active-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.18); }
}

.escape-progress-point[data-state="active"] {
  animation: escape-progress-active-pulse 920ms ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .escape-progress-point[data-state="active"] {
    animation: none !important;
    transform: none !important;
  }
}

@media (max-width: 560px) {
  .escape-progress-path[data-presentation="compact"] {
    max-width: calc(${GAME_VIEWPORT_WIDTH} - 112px) !important;
    grid-template-columns: 1fr !important;
    justify-items: end !important;
    gap: 5px !important;
  }

  .escape-progress-path[data-presentation="compact"] [data-role="escape-progress-label"] {
    font-size: 15px !important;
  }

  .escape-progress-path[data-presentation="compact"] [data-role="escape-progress-track"] {
    gap: 3px !important;
    max-width: 100% !important;
  }

  .escape-progress-path[data-presentation="expandedBreak"] {
    top: 64px !important;
    width: calc(${GAME_VIEWPORT_WIDTH} - 18px) !important;
  }

  .escape-progress-path[data-presentation="expandedBreak"] [data-role="escape-progress-track"] {
    gap: 5px !important;
  }
}
`.trim();
}
