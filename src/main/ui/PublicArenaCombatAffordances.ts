import { WEAPON_ARCHETYPES } from '../../shared/content/weapons';
import { PUBLIC_ARENA_LOADOUT } from '../../shared/content/publicArena';
import { PROJECTILE_VISUALS } from '../render/projectileVisuals';

import { COMIC_TEXT_FONT_FAMILY } from './comicTextStyle';
import {
  createHudFireHint,
  createHudMovementHint,
  createHudWeaponBarElement,
  createHudWeaponBarRenderState,
  renderHudWeaponSlots,
  type WeaponSlotViewModel
} from './Hud';

export type PublicArenaCombatAffordancesInit = Readonly<{
  parent: HTMLElement;
}>;

export type PublicArenaCombatAffordances = Readonly<{
  show(): void;
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

  renderHudWeaponSlots(createPublicArenaWeaponSlots(), weaponBar, weaponBarState);
  root.style.display = 'none';

  let visible = false;

  return {
    show(): void {
      visible = true;
      root.style.display = 'block';
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

function createPublicArenaWeaponSlots(): ReadonlyArray<WeaponSlotViewModel> {
  const selectedIndex = PUBLIC_ARENA_LOADOUT.selectedIndex;
  if (selectedIndex === null) {
    throw new Error('Public Arena portal loadout must select a weapon for the HUD slot bar.');
  }
  if (PUBLIC_ARENA_LOADOUT.weapons[selectedIndex] === undefined) {
    throw new Error(`Public Arena portal loadout has invalid selected index ${selectedIndex}.`);
  }

  return PUBLIC_ARENA_LOADOUT.weapons.map((weaponArchetypeId, index) => {
    const projectileVisual = PROJECTILE_VISUALS[weaponArchetypeId];
    if (projectileVisual === undefined) {
      throw new Error(
        `Public Arena weapon slot requires a projectile visual for ${weaponArchetypeId}.`
      );
    }
    const weapon = WEAPON_ARCHETYPES[weaponArchetypeId];
    return {
      index,
      hotkeyText: `${index + 1}`,
      weaponArchetypeId,
      titleText: weapon?.displayName ?? weaponArchetypeId,
      projectileImage: projectileVisual.image,
      isSelected: selectedIndex === index,
      cooldownRatio: 0,
      modifierBadges: [],
      timedBadges: []
    };
  });
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
