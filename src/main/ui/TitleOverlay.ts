import type { SessionDefinition } from '../../shared/session';
import type { EncounterSnapshot, Snapshot } from '../../shared/snapshot';
import type { SnapshotPair } from '../sim/SimWorkerHost';

import type { UiShellPhase } from './UiShellPhase';
import { comicTextStyle } from './comicTextStyle';
import { GAME_VIEWPORT_WIDTH } from './gameViewportCss';

export type TitleOverlayInit = Readonly<{
  parent: HTMLElement;
  isMobile?: boolean;
}>;

export type TitleOverlay = Readonly<{
  attach(session: SessionDefinition): void;
  update(snapshotPair: SnapshotPair, phase: UiShellPhase): void;
  detach(): void;
  dispose(): void;
}>;

export type TitleOverlayViewModel =
  | Readonly<{ kind: 'hidden' }>
  | Readonly<{
      kind: 'wave';
      titleText: string;
      nameText: string | null;
      opacity: number;
    }>
  | Readonly<{
      kind: 'break';
      text: string;
      opacity: number;
    }>;

const HIDDEN_VIEW_MODEL: TitleOverlayViewModel = Object.freeze({ kind: 'hidden' });

export function createTitleOverlay(init: TitleOverlayInit): TitleOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'title-overlay';
  root.style.cssText = rootStyle();
  root.style.display = 'none';

  const titleLine = document.createElement('div');
  titleLine.style.cssText = titleLineStyle(init.isMobile === true);
  root.appendChild(titleLine);

  const subtitleLine = document.createElement('div');
  subtitleLine.style.cssText = subtitleLineStyle(init.isMobile === true);
  root.appendChild(subtitleLine);

  init.parent.appendChild(root);

  let session: SessionDefinition | null = null;
  let lastVisibleViewModel: TitleOverlayViewModel = HIDDEN_VIEW_MODEL;

  return {
    attach(nextSession): void {
      session = nextSession;
      lastVisibleViewModel = HIDDEN_VIEW_MODEL;
      render(root, titleLine, subtitleLine, HIDDEN_VIEW_MODEL);
    },
    update(snapshotPair, phase): void {
      if (session === null) return;
      if (phase.kind === 'paused') {
        render(root, titleLine, subtitleLine, lastVisibleViewModel);
        return;
      }
      if (phase.kind !== 'running' && phase.kind !== 'online') {
        lastVisibleViewModel = HIDDEN_VIEW_MODEL;
        render(root, titleLine, subtitleLine, HIDDEN_VIEW_MODEL);
        return;
      }

      const viewModel = deriveTitleOverlayViewModel(session, snapshotPair.curr);
      lastVisibleViewModel = viewModel;
      render(root, titleLine, subtitleLine, viewModel);
    },
    detach(): void {
      session = null;
      lastVisibleViewModel = HIDDEN_VIEW_MODEL;
      render(root, titleLine, subtitleLine, HIDDEN_VIEW_MODEL);
    },
    dispose(): void {
      root.remove();
    }
  };
}

export function deriveTitleOverlayViewModel(
  session: SessionDefinition,
  snapshot: Snapshot | null
): TitleOverlayViewModel {
  const encounter = snapshot?.encounter ?? null;
  if (encounter === null) {
    return HIDDEN_VIEW_MODEL;
  }

  const resolved = resolveEncounterDefinition(session, encounter);
  if (resolved === null) {
    return HIDDEN_VIEW_MODEL;
  }

  const { definition, index } = resolved;
  if (definition.type === 'wave') {
    if (definition.introDurationMs <= 0 || encounter.elapsedMs >= definition.introDurationMs) {
      return HIDDEN_VIEW_MODEL;
    }

    const wavePosition = resolveWavePosition(session, index, encounter);
    if (wavePosition === null) {
      return HIDDEN_VIEW_MODEL;
    }

    return {
      kind: 'wave',
      titleText: `Wave ${wavePosition.index}`,
      nameText: definition.name,
      opacity: calculateIntroOpacity(encounter.elapsedMs, definition.introDurationMs)
    };
  }

  if (definition.type === 'break' && definition.text !== null) {
    return {
      kind: 'break',
      text: definition.text,
      opacity: 1
    };
  }

  return HIDDEN_VIEW_MODEL;
}

function render(
  root: HTMLElement,
  titleLine: HTMLElement,
  subtitleLine: HTMLElement,
  viewModel: TitleOverlayViewModel
): void {
  root.style.opacity = viewModel.kind === 'hidden' ? '0' : viewModel.opacity.toFixed(3);
  if (viewModel.kind === 'hidden') {
    root.style.display = 'none';
    titleLine.textContent = '';
    subtitleLine.textContent = '';
    return;
  }

  root.style.display = 'flex';
  if (viewModel.kind === 'wave') {
    titleLine.textContent = viewModel.titleText;
    subtitleLine.textContent = viewModel.nameText ?? '';
    subtitleLine.style.display = viewModel.nameText === null ? 'none' : 'block';
    return;
  }

  titleLine.textContent = '';
  subtitleLine.textContent = viewModel.text;
  subtitleLine.style.display = 'block';
}

function resolveEncounterDefinition(
  session: SessionDefinition,
  encounter: EncounterSnapshot
): Readonly<{ definition: SessionDefinition['encounters'][number]; index: number }> | null {
  const fromIndex = session.encounters[encounter.index];
  if (fromIndex?.id === encounter.id) {
    return { definition: fromIndex, index: encounter.index };
  }

  const index = session.encounters.findIndex((definition) => definition.id === encounter.id);
  if (index < 0) {
    return null;
  }
  return { definition: session.encounters[index]!, index };
}

function resolveWavePosition(
  session: SessionDefinition,
  encounterIndex: number,
  encounter: EncounterSnapshot
): Readonly<{ index: number; total: number }> | null {
  if (session.encounters[encounterIndex]?.type !== 'wave') {
    return null;
  }

  if (session.winCondition.kind === 'dungeon' && encounter.waveOrdinal !== null) {
    return {
      index: encounter.waveOrdinal,
      total: encounter.waveOrdinal
    };
  }

  const wavesBeforeOrAtEncounter = session.encounters
    .slice(0, encounterIndex + 1)
    .filter((encounter) => encounter.type === 'wave').length;
  const totalWaves = session.encounters.filter((encounter) => encounter.type === 'wave').length;
  return {
    index: wavesBeforeOrAtEncounter,
    total: totalWaves
  };
}

function calculateIntroOpacity(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) {
    return 0;
  }
  const fadeMs = Math.min(350, Math.max(120, durationMs / 4));
  const fadeIn = Math.min(1, elapsedMs / fadeMs);
  const fadeOut = Math.min(1, Math.max(0, durationMs - elapsedMs) / fadeMs);
  return Math.max(0, Math.min(1, fadeIn, fadeOut));
}

function rootStyle(): string {
  return [
    'position:fixed',
    'inset:0',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'box-sizing:border-box',
    'padding:24px 16px',
    'pointer-events:none',
    'z-index:60',
    'text-align:center',
    'transition:opacity 120ms ease'
  ].join(';');
}

function titleLineStyle(isMobile: boolean): string {
  return [
    'box-sizing:border-box',
    `max-width:min(936px, calc(${GAME_VIEWPORT_WIDTH} - 16px))`,
    'padding:6px 8px 8px',
    'font-variant:small-caps',
    ...comicTextStyle({
      fontSize: isMobile ? '22px' : '28px',
      fontWeight: 800,
      lineHeight: '1.1',
      color: '#f4fbff',
      shadow: 'strong'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function subtitleLineStyle(isMobile: boolean): string {
  return [
    'box-sizing:border-box',
    `max-width:min(936px, calc(${GAME_VIEWPORT_WIDTH} - 16px))`,
    'margin-top:2px',
    'padding:8px 10px 12px',
    ...comicTextStyle({
      fontSize: isMobile ? '30px' : '44px',
      color: '#ffffff',
      lineHeight: '1.05',
      shadow: 'strong'
    }),
    'overflow-wrap:anywhere',
    'display:-webkit-box',
    '-webkit-line-clamp:2',
    '-webkit-box-orient:vertical',
    'overflow:hidden'
  ].join(';');
}
