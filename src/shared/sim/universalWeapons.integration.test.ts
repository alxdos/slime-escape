import { describe, expect, it } from 'vitest';

import { buildSessionDefinition } from '../content/buildSession';
import { SANDBOX_WITH_COMBAT_PRESET } from '../content/sessions';
import {
  BOMB_PLACER,
  FIREBALL_STAFF,
  GRENADE_LAUNCHER,
  PISTOL,
  ROCK_THROWER
} from '../content/weapons';
import type { RuntimeEvent } from '../events';

import { createCombatSystem } from './CombatSystem';
import { createEntityStore } from './EntityStore';
import { createRuntimeActorInputState } from './RuntimeInputState';
import { createSpatialIndex } from './SpatialIndex';

describe('universal weapons demo session integration', () => {
  it('fires every sandbox-with-combat demo weapon from the authored ordered loadout', () => {
    const session = buildSessionDefinition(SANDBOX_WITH_COMBAT_PRESET, { seed: 17 });
    if (session.players[0].loadout === null) throw new Error('expected sandbox-with-combat loadout');

    const store = createEntityStore();
    const index = createSpatialIndex();
    const combat = createCombatSystem();
    const player = store.spawnPlayer(session.players[0]);
    combat.setPlayerLoadout(player.id, session.players[0].loadout, 0);
    const events: RuntimeEvent[] = [];
    const expectedWeaponIds = [
      PISTOL.id,
      ROCK_THROWER.id,
      GRENADE_LAUNCHER.id,
      BOMB_PLACER.id,
      FIREBALL_STAFF.id
    ];

    expect(session.players[0].loadout.weapons).toEqual(expectedWeaponIds);

    for (let selectedIndex = 0; selectedIndex < expectedWeaponIds.length; selectedIndex += 1) {
      const input = createRuntimeActorInputState();
      input.firing = true;
      input.aimWorld = { x: player.position.x + 5, y: player.position.y };
      input.loadout = { weapons: session.players[0].loadout.weapons, selectedIndex };
      combat.tick(input, store, index, selectedIndex, session.arena, (event) =>
        events.push(event)
      );
    }

    const fireEvents = events.filter((event): event is Extract<RuntimeEvent, { kind: 'fire' }> => {
      return event.kind === 'fire';
    });
    expect(fireEvents.map((event) => event.weaponArchetypeId)).toEqual(expectedWeaponIds);

    const projectiles = [...store.projectiles()];
    expect(projectiles).toHaveLength(8);
    expect(projectiles.filter((projectile) => projectile.weaponArchetypeId === PISTOL.id)).toHaveLength(
      1
    );
    expect(projectiles.filter((projectile) => projectile.weaponArchetypeId === ROCK_THROWER.id)).toHaveLength(
      1
    );
    expect(
      projectiles.filter((projectile) => projectile.weaponArchetypeId === GRENADE_LAUNCHER.id)
    ).toHaveLength(1);
    expect(projectiles.filter((projectile) => projectile.weaponArchetypeId === BOMB_PLACER.id)).toHaveLength(
      1
    );
    expect(
      projectiles.filter((projectile) => projectile.weaponArchetypeId === FIREBALL_STAFF.id)
    ).toHaveLength(4);
    expect(projectiles.some((projectile) => projectile.motionKind === 'arc')).toBe(true);
    expect(
      projectiles.some(
        (projectile) => projectile.motionKind === 'placed' && projectile.state === 'grounded'
      )
    ).toBe(true);
  });
});
