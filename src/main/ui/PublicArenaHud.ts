import type {
  PublicArenaPlayerId
} from '../../shared/arenaHostProtocol';
import { PUBLIC_ARENA_BOSS_LEVEL } from '../../shared/publicArenaProgression';
import {
  publicArenaSnapshotView,
  type PublicArenaOnlineSnapshot
} from '../online/publicArenaSnapshotView';

import { comicTextStyle } from './comicTextStyle';

export type PublicArenaHudInit = Readonly<{
  parent: HTMLElement;
}>;

export type PublicArenaHud = Readonly<{
  show(): void;
  update(
    snapshot: PublicArenaOnlineSnapshot | null,
    selfId: PublicArenaPlayerId | null,
    playerCap: number | null
  ): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}>;

export function createPublicArenaHud(init: PublicArenaHudInit): PublicArenaHud {
  const root = document.createElement('section');
  root.dataset['role'] = 'public-arena-hud';
  root.style.cssText = rootStyle();
  root.style.display = 'none';

  const level = document.createElement('div');
  level.dataset['role'] = 'public-arena-hud-level';
  level.style.cssText = levelPanelStyle();
  root.appendChild(level);

  const population = document.createElement('div');
  population.dataset['role'] = 'public-arena-hud-population';
  population.style.cssText = populationPanelStyle();
  root.appendChild(population);

  init.parent.appendChild(root);

  let visible = false;
  let lastLevelText: string | null = null;
  let lastPopulationText: string | null = null;

  function render(
    snapshot: PublicArenaOnlineSnapshot | null,
    selfId: PublicArenaPlayerId | null
  ): void {
    const view = publicArenaSnapshotView(snapshot);
    const self =
      selfId === null
        ? null
        : (view?.players.find((player) => player.id === selfId) ?? null);
    const levelText =
      self === null
        ? `Level --/${PUBLIC_ARENA_BOSS_LEVEL}`
        : `Level ${Math.min(self.level, PUBLIC_ARENA_BOSS_LEVEL)}/${PUBLIC_ARENA_BOSS_LEVEL}`;
    const populationText =
      view === null ? 'Online --' : `Online ${view.population}`;
    if (lastLevelText !== levelText) {
      level.textContent = levelText;
      lastLevelText = levelText;
    }
    if (lastPopulationText !== populationText) {
      population.textContent = populationText;
      lastPopulationText = populationText;
    }
  }

  render(null, null);

  return {
    show(): void {
      visible = true;
      root.style.display = 'block';
    },
    update(snapshot, selfId, _playerCap): void {
      render(snapshot, selfId);
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
    'top:42px',
    'left:clamp(12px,4vw,56px)',
    'right:clamp(12px,4vw,56px)',
    'z-index:31',
    'display:block',
    'pointer-events:none',
    'height:52px',
    'box-sizing:border-box'
  ].join(';');
}

function populationPanelStyle(): string {
  return [
    'position:absolute',
    'top:0',
    'left:0',
    'width:min(190px, calc(50vw - 24px))',
    'box-sizing:border-box',
    'padding:10px 14px 12px',
    'background:rgba(5,8,14,0.62)',
    'border:2px solid rgba(255,255,255,0.16)',
    'border-radius:8px',
    'box-shadow:0 12px 30px rgba(0,0,0,0.32)',
    ...comicTextStyle({
      fontSize: '18px',
      color: '#eef4ff',
      lineHeight: '1',
      textAlign: 'left'
    }),
    'font-size:min(18px, 4.8vw)',
    'opacity:0.92',
    'overflow-wrap:anywhere'
  ].join(';');
}

function levelPanelStyle(): string {
  return [
    'position:absolute',
    'top:0',
    'right:0',
    'width:min(190px, calc(50vw - 24px))',
    'box-sizing:border-box',
    'padding:10px 14px 12px',
    'background:rgba(5,8,14,0.66)',
    'border:2px solid rgba(255,243,139,0.22)',
    'border-radius:8px',
    'box-shadow:0 12px 30px rgba(0,0,0,0.32)',
    ...comicTextStyle({
      fontSize: '24px',
      color: '#fff38b',
      lineHeight: '1',
      textAlign: 'right'
    }),
    'font-size:min(24px, 6vw)',
    'overflow-wrap:anywhere'
  ].join(';');
}
