import type { PublicArenaPlayerId } from '../../shared/publicArenaProtocol';
import {
  publicArenaSnapshotView,
  type PublicArenaOnlineSnapshot
} from '../online/publicArenaSnapshotView';

import { COMIC_TEXT_FONT_FAMILY } from './comicTextStyle';
import {
  createHudFireHint,
  createHudMovementHint,
  createHudWeaponBarElement,
  createHudWeaponBarRenderState,
  deriveWeaponSlotsForHud,
  renderHudWeaponSlots
} from './Hud';

export type PublicArenaCombatAffordancesInit = Readonly<{
  parent: HTMLElement;
}>;

export type PublicArenaCombatAffordances = Readonly<{
  show(): void;
  update(snapshot: PublicArenaOnlineSnapshot | null, selfId: PublicArenaPlayerId | null): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}>;

export function createPublicArenaCombatAffordances(
  init: PublicArenaCombatAffordancesInit
): PublicArenaCombatAffordances {
  const root = document.createElement('div');
  root.dataset['role'] = 'public-arena-combat-affordances';
  root.style.cssText = rootStyle();

  const weaponBar = createHudWeaponBarElement();
  const weaponBarState = createHudWeaponBarRenderState();

  root.appendChild(createHudMovementHint(false));
  root.appendChild(weaponBar);
  root.appendChild(createHudFireHint(false));
  init.parent.appendChild(root);

  renderHudWeaponSlots([], weaponBar, weaponBarState);
  root.style.display = 'none';

  let visible = false;

  return {
    show(): void {
      visible = true;
      root.style.display = 'block';
    },
    update(snapshot, selfId): void {
      const view = publicArenaSnapshotView(snapshot);
      const self =
        selfId === null ? null : (view?.players.find((player) => player.id === selfId) ?? null);
      renderHudWeaponSlots(
        deriveWeaponSlotsForHud(self?.weaponHud ?? null, view?.simTimeMs ?? 0),
        weaponBar,
        weaponBarState
      );
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
    'inset:0',
    'z-index:30',
    'display:block',
    'pointer-events:none',
    `font-family:${COMIC_TEXT_FONT_FAMILY}`,
    'color:#eef4ff'
  ].join(';');
}
