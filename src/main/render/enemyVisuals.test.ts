import { describe, expect, it } from 'vitest';

import {
  DROP_ARCHETYPES,
  HEAL_ORB,
  type DropArchetype
} from '../../shared/content/drops';
import {
  ENEMY_ARCHETYPES,
  SLIME_BUG,
  type EnemyArchetype
} from '../../shared/content/enemies';
import {
  PISTOL,
  WEAPON_ARCHETYPES,
  type WeaponArchetype
} from '../../shared/content/weapons';

import { DROP_VISUALS, validateDropVisuals } from './dropVisuals';
import { ENEMY_VISUALS, validateEnemyVisuals } from './enemyVisuals';
import { PROJECTILE_VISUALS, validateProjectileVisuals } from './projectileVisuals';

describe('validateEnemyVisuals', () => {
  it('accepts the committed enemy registry', () => {
    expect(() => validateEnemyVisuals(ENEMY_ARCHETYPES)).not.toThrow();
  });

  it('rejects enemy archetypes without a visual spec', () => {
    const ghostEnemy: EnemyArchetype = {
      ...SLIME_BUG,
      id: 'ghost-slime'
    };

    expect(() =>
      validateEnemyVisuals({
        ...ENEMY_ARCHETYPES,
        [ghostEnemy.id]: ghostEnemy
      })
    ).toThrow('enemy visual missing for archetype "ghost-slime"');
  });

  it('rejects orphan enemy visuals', () => {
    expect(() => validateEnemyVisuals({})).toThrow(
      'enemy visual references unknown archetype "slime-one-eye"'
    );
  });

  it('covers every committed enemy archetype id', () => {
    expect(Object.keys(ENEMY_VISUALS)).toHaveLength(30);
    expect(Object.keys(ENEMY_VISUALS).sort()).toEqual(Object.keys(ENEMY_ARCHETYPES).sort());
  });
});

describe('validateProjectileVisuals', () => {
  it('accepts the committed weapon registry', () => {
    expect(() => validateProjectileVisuals(WEAPON_ARCHETYPES)).not.toThrow();
  });

  it('rejects weapon archetypes without a projectile visual spec', () => {
    const ghostWeapon: WeaponArchetype = {
      ...PISTOL,
      id: 'ghost-weapon'
    };

    expect(() =>
      validateProjectileVisuals({
        ...WEAPON_ARCHETYPES,
        [ghostWeapon.id]: ghostWeapon
      })
    ).toThrow('projectile visual missing for weapon archetype "ghost-weapon"');
  });

  it('rejects orphan projectile visuals', () => {
    expect(() => validateProjectileVisuals({})).toThrow(
      'projectile visual references unknown weapon archetype "pistol"'
    );
  });

  it('rejects projectile visuals that drift from generated weapon size', () => {
    const driftedPistol: WeaponArchetype = {
      ...PISTOL,
      projectile: {
        ...PISTOL.projectile,
        size: {
          width: PISTOL.projectile.size.width + 0.1,
          height: PISTOL.projectile.size.height
        }
      }
    };

    expect(() =>
      validateProjectileVisuals({
        ...WEAPON_ARCHETYPES,
        [PISTOL.id]: driftedPistol
      })
    ).toThrow('projectile visual "pistol" worldSize does not match weapon projectile.size');
  });

  it('covers every committed weapon archetype id', () => {
    expect(Object.keys(PROJECTILE_VISUALS).sort()).toEqual(Object.keys(WEAPON_ARCHETYPES).sort());
  });
});

describe('validateDropVisuals', () => {
  it('accepts the committed drop registry', () => {
    expect(() => validateDropVisuals(DROP_ARCHETYPES)).not.toThrow();
  });

  it('rejects drop archetypes without a visual spec', () => {
    const ghostDrop: DropArchetype = {
      ...HEAL_ORB,
      id: 'ghost-drop'
    };

    expect(() =>
      validateDropVisuals({
        ...DROP_ARCHETYPES,
        [ghostDrop.id]: ghostDrop
      })
    ).toThrow('drop visual missing for archetype "ghost-drop"');
  });

  it('rejects orphan drop visuals', () => {
    expect(() => validateDropVisuals({})).toThrow(
      'drop visual references unknown archetype "heal-orb"'
    );
  });

  it('rejects drop visuals that drift from generated drop radius', () => {
    const driftedHealOrb: DropArchetype = {
      ...HEAL_ORB,
      radius: HEAL_ORB.radius + 0.1
    };

    expect(() =>
      validateDropVisuals({
        ...DROP_ARCHETYPES,
        [HEAL_ORB.id]: driftedHealOrb
      })
    ).toThrow('drop visual "heal-orb" worldSize does not match drop radius');
  });

  it('covers every committed drop archetype id', () => {
    expect(Object.keys(DROP_VISUALS).sort()).toEqual(Object.keys(DROP_ARCHETYPES).sort());
  });
});
