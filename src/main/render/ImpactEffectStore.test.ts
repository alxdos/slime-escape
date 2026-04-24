import { describe, expect, it } from 'vitest';

import { BOSS_ARCHETYPES, BOSS_GARGOYLE } from '../../shared/content/bosses';
import { ENEMY_ARCHETYPES, SLIME_BUG } from '../../shared/content/enemies';
import { WEAPON_ARCHETYPES } from '../../shared/content/weapons';
import { createImpactEffectStore } from './ImpactEffectStore';

function createStore() {
  return createImpactEffectStore({
    enemyRegistry: ENEMY_ARCHETYPES,
    bossRegistry: BOSS_ARCHETYPES,
    weaponRegistry: WEAPON_ARCHETYPES
  });
}

describe('ImpactEffectStore', () => {
  it('creates render-only hit impulses and droplets for enemy projectile hits', () => {
    const store = createStore();

    store.handleEvent(
      {
        kind: 'hit',
        simTime: 100,
        projectileId: 10,
        targetId: 20,
        targetKind: 'enemy',
        targetArchetypeId: SLIME_BUG.id,
        weaponArchetypeId: 'pistol',
        damage: 1,
        impactDirX: 2,
        impactDirY: 0,
        x: 3,
        y: 4
      },
      500
    );

    const snapshot = store.snapshot();
    expect(snapshot.hitImpulses).toHaveLength(1);
    expect(snapshot.hitImpulses[0]).toMatchObject({
      targetId: 20,
      targetKind: 'enemy',
      dirX: 1,
      dirY: 0
    });
    expect(snapshot.droplets.length).toBeGreaterThan(0);
    expect(snapshot.droplets.every((droplet) => droplet.color === SLIME_BUG.color)).toBe(true);
    expect(snapshot.deathGhosts).toHaveLength(0);
  });

  it('ignores player hits because slime effects are enemy and boss presentation only', () => {
    const store = createStore();

    store.handleEvent(
      {
        kind: 'hit',
        simTime: 100,
        projectileId: 10,
        targetId: 1,
        targetKind: 'player',
        targetArchetypeId: null,
        weaponArchetypeId: 'pistol',
        damage: 1,
        impactDirX: 1,
        impactDirY: 0,
        x: 0,
        y: 0
      },
      0
    );

    expect(store.snapshot()).toEqual({
      hitImpulses: [],
      droplets: [],
      deathGhosts: []
    });
  });

  it('creates death ghosts and larger bursts for slime deaths', () => {
    const store = createStore();

    store.handleEvent(
      {
        kind: 'death',
        simTime: 200,
        entityId: 30,
        entityKind: 'boss',
        archetypeId: BOSS_GARGOYLE.id,
        weaponArchetypeId: 'shotgun',
        impactDirX: 1,
        impactDirY: 0,
        x: -2,
        y: 1
      },
      1000
    );

    const snapshot = store.snapshot();
    expect(snapshot.deathGhosts).toHaveLength(1);
    expect(snapshot.deathGhosts[0]).toMatchObject({
      entityId: 30,
      entityKind: 'boss',
      archetypeId: BOSS_GARGOYLE.id
    });
    expect(snapshot.deathGhosts[0]?.vy).toBeGreaterThan(snapshot.deathGhosts[0]?.vx ?? 0);
    expect(snapshot.droplets.length).toBeGreaterThan(18);
    expect(snapshot.droplets.every((droplet) => droplet.color === BOSS_GARGOYLE.color)).toBe(true);
  });

  it('expires transient effects and clears all render-only state on dispose/session teardown', () => {
    const store = createStore();

    store.handleEvent(
      {
        kind: 'death',
        simTime: 200,
        entityId: 30,
        entityKind: 'enemy',
        archetypeId: SLIME_BUG.id,
        weaponArchetypeId: 'pistol',
        impactDirX: null,
        impactDirY: null,
        x: 0,
        y: 0
      },
      1000
    );

    expect(store.snapshot().droplets.length).toBeGreaterThan(0);
    store.update(70_000);
    expect(store.snapshot()).toEqual({
      hitImpulses: [],
      droplets: [],
      deathGhosts: []
    });

    store.handleEvent(
      {
        kind: 'hit',
        simTime: 300,
        projectileId: 40,
        targetId: 50,
        targetKind: 'enemy',
        targetArchetypeId: SLIME_BUG.id,
        weaponArchetypeId: 'pistol',
        damage: 1,
        impactDirX: 1,
        impactDirY: 0,
        x: 0,
        y: 0
      },
      80_000
    );
    store.clear();
    expect(store.snapshot()).toEqual({
      hitImpulses: [],
      droplets: [],
      deathGhosts: []
    });
  });

  it('updates positions from effect start time rather than accumulating per frame', () => {
    const store = createStore();

    store.handleEvent(
      {
        kind: 'death',
        simTime: 200,
        entityId: 30,
        entityKind: 'enemy',
        archetypeId: SLIME_BUG.id,
        weaponArchetypeId: 'pistol',
        impactDirX: 1,
        impactDirY: 0,
        x: 1,
        y: 2
      },
      1000
    );

    store.update(1200);
    const once = store.snapshot();
    const ghostX = once.deathGhosts[0]?.x;
    const dropletX = once.droplets[0]?.x;
    store.update(1200);
    const twice = store.snapshot();

    expect(twice.deathGhosts[0]?.x).toBe(ghostX);
    expect(twice.droplets[0]?.x).toBe(dropletX);
  });

  it('keeps effect counts bounded when many impacts arrive before cleanup', () => {
    const store = createStore();

    for (let i = 0; i < 100; i += 1) {
      store.handleEvent(
        {
          kind: 'death',
          simTime: i,
          entityId: i,
          entityKind: 'enemy',
          archetypeId: SLIME_BUG.id,
          weaponArchetypeId: 'shotgun',
          impactDirX: 1,
          impactDirY: 0,
          x: 0,
          y: 0
        },
        0
      );
    }

    const snapshot = store.snapshot();
    expect(snapshot.deathGhosts.length).toBeLessThanOrEqual(32);
    expect(snapshot.droplets.length).toBeLessThanOrEqual(420);
  });
});
