import type { SessionDefinition } from '../../shared/session';
import type { Snapshot } from '../../shared/snapshot';
import type { SnapshotPair } from '../sim/SimWorkerHost';

import type { UiShellPhase } from './UiShellPhase';
import { comicTextStyle } from './comicTextStyle';

export type DungeonWaveCounterInit = Readonly<{
  parent: HTMLElement;
}>;

export type DungeonWaveCounter = Readonly<{
  attach(session: SessionDefinition): void;
  update(snapshotPair: SnapshotPair, phase: UiShellPhase): void;
  detach(): void;
  dispose(): void;
}>;

export type DungeonWaveCounterViewModel =
  | Readonly<{ kind: 'hidden' }>
  | Readonly<{ kind: 'wave'; ordinal: number }>;

const HIDDEN_VIEW_MODEL: DungeonWaveCounterViewModel = Object.freeze({ kind: 'hidden' });

export function createDungeonWaveCounter(init: DungeonWaveCounterInit): DungeonWaveCounter {
  const root = document.createElement('section');
  root.className = 'dungeon-wave-counter';
  root.dataset['role'] = 'dungeon-wave-counter';
  root.style.cssText = rootStyle();
  root.style.display = 'none';

  const style = document.createElement('style');
  style.textContent = dungeonWaveCounterCss();
  root.appendChild(style);

  const label = document.createElement('span');
  label.dataset['role'] = 'dungeon-wave-counter-label';
  label.style.cssText = labelStyle();
  label.textContent = 'Wave';
  root.appendChild(label);

  const value = document.createElement('span');
  value.dataset['role'] = 'dungeon-wave-counter-value';
  value.style.cssText = valueStyle();
  root.appendChild(value);

  init.parent.appendChild(root);

  let session: SessionDefinition | null = null;
  let lastVisibleViewModel: DungeonWaveCounterViewModel = HIDDEN_VIEW_MODEL;
  let renderSignature: string | null = null;

  return {
    attach(nextSession): void {
      session = nextSession;
      lastVisibleViewModel = HIDDEN_VIEW_MODEL;
      renderSignature = null;
      render(root, value, HIDDEN_VIEW_MODEL);
    },
    update(snapshotPair, phase): void {
      if (session === null) return;
      if (phase.kind === 'paused') {
        render(root, value, lastVisibleViewModel);
        return;
      }
      if (phase.kind !== 'running') {
        lastVisibleViewModel = HIDDEN_VIEW_MODEL;
        render(root, value, HIDDEN_VIEW_MODEL);
        return;
      }

      const viewModel = deriveDungeonWaveCounterViewModel(session, snapshotPair.curr);
      lastVisibleViewModel = viewModel;
      render(root, value, viewModel);
    },
    detach(): void {
      session = null;
      lastVisibleViewModel = HIDDEN_VIEW_MODEL;
      renderSignature = null;
      render(root, value, HIDDEN_VIEW_MODEL);
    },
    dispose(): void {
      root.remove();
    }
  };

  function render(
    rootElement: HTMLElement,
    valueElement: HTMLElement,
    viewModel: DungeonWaveCounterViewModel
  ): void {
    const nextSignature = viewModel.kind === 'hidden' ? 'hidden' : `wave:${viewModel.ordinal}`;
    if (renderSignature === nextSignature) {
      return;
    }
    renderSignature = nextSignature;

    if (viewModel.kind === 'hidden') {
      rootElement.style.display = 'none';
      valueElement.textContent = '';
      rootElement.removeAttribute('aria-label');
      return;
    }

    rootElement.style.display = 'grid';
    valueElement.textContent = String(viewModel.ordinal);
    rootElement.setAttribute('aria-label', `Dungeon wave ${viewModel.ordinal}`);
  }
}

export function deriveDungeonWaveCounterViewModel(
  session: SessionDefinition,
  snapshot: Snapshot | null
): DungeonWaveCounterViewModel {
  if (session.winCondition.kind !== 'dungeon') {
    return HIDDEN_VIEW_MODEL;
  }

  const ordinal = snapshot?.encounter?.waveOrdinal ?? null;
  if (ordinal === null || !Number.isFinite(ordinal) || ordinal < 1) {
    return HIDDEN_VIEW_MODEL;
  }

  return { kind: 'wave', ordinal: Math.floor(ordinal) };
}

function rootStyle(): string {
  return [
    'position:fixed',
    'top:10px',
    'right:14px',
    'display:none',
    'grid-template-columns:max-content max-content',
    'align-items:baseline',
    'justify-content:end',
    'gap:8px',
    'pointer-events:none',
    'z-index:46',
    'padding:4px 0',
    'text-align:right',
    'font-variant-numeric:tabular-nums',
    'font-feature-settings:"tnum"'
  ].join(';');
}

function labelStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '17px',
      fontWeight: 900,
      lineHeight: '1',
      color: '#ffffff'
    }),
    'white-space:nowrap'
  ].join(';');
}

function valueStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '29px',
      fontWeight: 900,
      lineHeight: '0.92',
      color: '#ffd166',
      shadow: 'strong'
    }),
    '-webkit-text-stroke:1.4px rgba(5,5,5,0.62)',
    'paint-order:stroke fill',
    'white-space:nowrap'
  ].join(';');
}

function dungeonWaveCounterCss(): string {
  return `
@media (max-width: 560px) {
  .dungeon-wave-counter {
    right: 12px !important;
    gap: 6px !important;
  }

  .dungeon-wave-counter [data-role="dungeon-wave-counter-label"] {
    font-size: 15px !important;
  }

  .dungeon-wave-counter [data-role="dungeon-wave-counter-value"] {
    font-size: 25px !important;
  }
}
`.trim();
}
