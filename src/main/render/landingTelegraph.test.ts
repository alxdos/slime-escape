import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { GRENADE_LAUNCHER, ROCK_THROWER } from '../../shared/content/weapons';
import type { ProjectileSnapshot, Snapshot } from '../../shared/snapshot';

import {
  createLandingTelegraphLayer,
  LANDING_TELEGRAPH_NAME,
  shouldShowLandingTelegraph
} from './landingTelegraph';

describe('landingTelegraph', () => {
  it('shows a landing marker only for non-player flying arc projectiles', () => {
    const scene = new THREE.Scene();
    const layer = createLandingTelegraphLayer(scene);

    layer.update(
      snapshot([
        projectile({
          id: 1,
          ownerKind: 'enemy',
          weaponArchetypeId: GRENADE_LAUNCHER.id,
          arcEnd: { x: 2, y: -3 }
        }),
        projectile({
          id: 2,
          ownerKind: 'player',
          weaponArchetypeId: GRENADE_LAUNCHER.id,
          arcEnd: { x: 4, y: 4 }
        }),
        projectile({
          id: 3,
          ownerKind: 'boss',
          weaponArchetypeId: GRENADE_LAUNCHER.id,
          state: 'grounded',
          arcEnd: null
        }),
        projectile({
          id: 4,
          ownerKind: 'enemy',
          weaponArchetypeId: GRENADE_LAUNCHER.id,
          arcEnd: null
        })
      ]),
      0
    );

    const markers = landingMarkers(scene);
    expect(markers).toHaveLength(1);
    expect(markers[0]!.position.x).toBeCloseTo(2);
    expect(markers[0]!.position.y).toBeCloseTo(-3);
    expect(markers[0]!.scale.x).toBeCloseTo(GRENADE_LAUNCHER.projectile.explosion!.radius * 2);
  });

  it('uses a fixed diameter for non-explosive arc projectiles', () => {
    const scene = new THREE.Scene();
    const layer = createLandingTelegraphLayer(scene);

    layer.update(
      snapshot([
        projectile({
          id: 1,
          ownerKind: 'enemy',
          weaponArchetypeId: ROCK_THROWER.id,
          arcEnd: { x: -1, y: 1 }
        })
      ]),
      0
    );

    expect(landingMarkers(scene)[0]?.scale.x).toBeCloseTo(0.4);
  });

  it('removes markers when the projectile no longer satisfies the telegraph filter', () => {
    const scene = new THREE.Scene();
    const layer = createLandingTelegraphLayer(scene);

    layer.update(
      snapshot([
        projectile({
          id: 1,
          ownerKind: 'enemy',
          weaponArchetypeId: ROCK_THROWER.id,
          arcEnd: { x: -1, y: 1 }
        })
      ]),
      0
    );
    expect(landingMarkers(scene)).toHaveLength(1);

    layer.update(
      snapshot([
        projectile({
          id: 1,
          ownerKind: 'enemy',
          weaponArchetypeId: ROCK_THROWER.id,
          state: 'grounded',
          arcEnd: null
        })
      ]),
      100
    );

    expect(landingMarkers(scene)).toHaveLength(0);
  });

  it('clears and disposes all pooled markers', () => {
    const scene = new THREE.Scene();
    const layer = createLandingTelegraphLayer(scene);

    layer.update(
      snapshot([
        projectile({
          id: 1,
          ownerKind: 'enemy',
          weaponArchetypeId: ROCK_THROWER.id,
          arcEnd: { x: 0, y: 0 }
        })
      ]),
      0
    );
    layer.dispose();

    expect(landingMarkers(scene)).toHaveLength(0);
  });

  it('exposes the renderer filter as a pure predicate', () => {
    expect(
      shouldShowLandingTelegraph(
        projectile({ ownerKind: 'enemy', arcEnd: { x: 0, y: 0 } })
      )
    ).toBe(true);
    expect(
      shouldShowLandingTelegraph(
        projectile({ ownerKind: 'player', arcEnd: { x: 0, y: 0 } })
      )
    ).toBe(false);
    expect(shouldShowLandingTelegraph(projectile({ ownerKind: 'enemy', arcEnd: null }))).toBe(
      false
    );
  });
});

function landingMarkers(scene: THREE.Scene): THREE.Mesh[] {
  return scene.children.filter(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.name === LANDING_TELEGRAPH_NAME
  );
}

function snapshot(projectiles: ReadonlyArray<ProjectileSnapshot>): Snapshot {
  return {
    simTimeMs: 0,
    entities: projectiles,
    encounter: null,
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null,
    lastInputSequence: {}
  };
}

function projectile(overrides: Partial<ProjectileSnapshot> = {}): ProjectileSnapshot {
  return {
    id: 1,
    kind: 'projectile',
    weaponArchetypeId: ROCK_THROWER.id,
    ownerKind: 'enemy',
    ownerId: 1,
    originX: 0,
    originY: 0,
    x: 0,
    y: 0,
    size: ROCK_THROWER.projectile.size,
    state: 'flying',
    visualState: { angleRadians: 0, spinRadians: 0, pulsePhase: 0 },
    explosionRadius: null,
    detonateAtSimMs: null,
    arcEnd: { x: 0, y: 0 },
    spawnInputSequence: null,
    ...overrides
  };
}
