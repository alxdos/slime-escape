import type { PublicArenaSnapshot } from '../../shared/publicArenaProtocol';
import { PUBLIC_ARENA_BOSS_LEVEL } from '../../shared/publicArenaProgression';

import { comicTextStyle } from './comicTextStyle';

export type PublicArenaHudInit = Readonly<{
  parent: HTMLElement;
}>;

export type PublicArenaHud = Readonly<{
  show(): void;
  update(snapshot: PublicArenaSnapshot | null, playerCap: number | null): void;
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
  level.style.cssText = primaryTextStyle();
  root.appendChild(level);

  const population = document.createElement('div');
  population.dataset['role'] = 'public-arena-hud-population';
  population.style.cssText = secondaryTextStyle();
  root.appendChild(population);

  init.parent.appendChild(root);

  let visible = false;
  let lastLevelText: string | null = null;
  let lastPopulationText: string | null = null;

  function render(snapshot: PublicArenaSnapshot | null): void {
    const self = snapshot?.players.find((player) => player.id === snapshot.selfId) ?? null;
    const levelText =
      self === null
        ? `Level --/${PUBLIC_ARENA_BOSS_LEVEL}`
        : `Level ${Math.min(self.level, PUBLIC_ARENA_BOSS_LEVEL)}/${PUBLIC_ARENA_BOSS_LEVEL}`;
    const populationText =
      snapshot === null ? 'Online --' : `Online ${snapshot.population}`;
    if (lastLevelText !== levelText) {
      level.textContent = levelText;
      lastLevelText = levelText;
    }
    if (lastPopulationText !== populationText) {
      population.textContent = populationText;
      lastPopulationText = populationText;
    }
  }

  render(null);

  return {
    show(): void {
      visible = true;
      root.style.display = 'grid';
    },
    update(snapshot, _playerCap): void {
      render(snapshot);
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
    'left:56px',
    'z-index:31',
    'display:grid',
    'gap:4px',
    'pointer-events:none',
    'min-width:150px',
    'box-sizing:border-box',
    'padding:10px 14px 12px',
    'background:rgba(5,8,14,0.62)',
    'border:2px solid rgba(255,255,255,0.16)',
    'border-radius:8px',
    'box-shadow:0 12px 30px rgba(0,0,0,0.32)'
  ].join(';');
}

function primaryTextStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '24px',
      color: '#fff38b',
      lineHeight: '1',
      textAlign: 'left'
    }),
    'font-size:min(24px, 6vw)',
    'overflow-wrap:anywhere'
  ].join(';');
}

function secondaryTextStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '16px',
      color: '#eef4ff',
      lineHeight: '1',
      textAlign: 'left'
    }),
    'font-size:min(16px, 4.5vw)',
    'opacity:0.88',
    'overflow-wrap:anywhere'
  ].join(';');
}
