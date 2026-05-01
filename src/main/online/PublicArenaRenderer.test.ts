import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  PUBLIC_ARENA_PRESENTATION_CONFIG
} from '../../shared/content/publicArena';
import {
  PUBLIC_ARENA_BOSS_ARCHETYPE_ID,
  PUBLIC_ARENA_BOSS_LEVEL
} from '../../shared/publicArenaProgression';
import type { Snapshot } from '../../shared/snapshot';
import { SIM_STEP_MS, SNAPSHOT_INTERVAL_MS } from '../../shared/timing';
import { ARC_PREVIEW_NAME } from '../render/arcPreview';
import { DEFAULT_PLAYER_VISUAL } from '../render/playerVisuals';
import type { TextureMap } from '../render/spritePreload';
import type { SnapshotPair } from '../sim/SimWorkerHost';
import {
  VIBE_JAM_PORTAL_GROUP_NAME,
  VIBE_JAM_PORTAL_RETURN_LABEL_NAME
} from '../render/vibeJamPortalPresentation';

import { createPublicArenaRenderer } from './PublicArenaRenderer';

class FakeStyle {
  width = '';
  height = '';
  imageRendering = '';
}

function createRendererBackendHarness() {
  let lastScene: THREE.Scene | null = null;
  let lastCamera: THREE.Camera | null = null;
  let disposeCalls = 0;
  const sizes: Array<Readonly<{ width: number; height: number }>> = [];

  return {
    factory() {
      return {
        setPixelRatio(): void {},
        setSize(width: number, height: number): void {
          sizes.push({ width, height });
        },
        render(scene: THREE.Scene, camera: THREE.Camera): void {
          lastScene = scene;
          lastCamera = camera;
        },
        dispose(): void {
          disposeCalls += 1;
        }
      };
    },
    lastScene(): THREE.Scene {
      if (lastScene === null) {
        throw new Error('scene was not rendered');
      }
      return lastScene;
    },
    lastCamera(): THREE.Camera {
      if (lastCamera === null) {
        throw new Error('camera was not rendered');
      }
      return lastCamera;
    },
    disposeCalls(): number {
      return disposeCalls;
    },
    sizes
  };
}

describe('PublicArenaRenderer', () => {
  it('renders online slime, boss, projectile, and level label snapshots', () => {
    let snapshot: Snapshot | null = makeSnapshot();
    let predictedSnapshot: Snapshot | null = null;
    let pair: SnapshotPair = snapshotPair(snapshot);
    const backend = createRendererBackendHarness();
    const textures = createSpriteTextures();
    const backgroundTexture = createBackgroundTexture();
    const activeBackground = requireActivePublicArenaBackground();
    const renderer = createPublicArenaRenderer({
      canvas: makeCanvas(),
      arena: PUBLIC_ARENA_PRESENTATION_CONFIG.arena,
      selfId: 'self',
      renderScalePreset: 'medium',
      spriteTextures: textures,
      getSnapshotPair: () => pair,
      getPredictedSnapshotPair: () => snapshotPair(predictedSnapshot),
      getAim: () => ({ x: 12, y: -6 }),
      windowTarget: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 },
      createRendererBackend: backend.factory,
      loadBackgroundTexture(url, onLoad) {
        expect(url).toBe(activeBackground.imageUrl);
        onLoad?.(backgroundTexture);
        return backgroundTexture;
      }
    });

    renderer.render();

    const scene = backend.lastScene();
    const players = findAllByName(scene, 'public-arena-player');
    const labels = findAllByName(scene, 'public-arena-level-label');
    const projectiles = findAllByName(scene, 'public-arena-projectile');
    const boss = players.find((player) => player.userData['formKind'] === 'boss');
    const slime = players.find((player) => player.userData['playerId'] === 'self');
    const crosshair = findAllByName(scene, 'crosshair')[0];
    const arcPreview = findAllByName(scene, ARC_PREVIEW_NAME)[0];
    const selfHpBar = findAllByName(slime ?? new THREE.Group(), 'public-arena-self-hp-bar')[0];
    const selfHpFill = findAllByName(slime ?? new THREE.Group(), 'public-arena-self-hp-fill')[0];
    const selfLabel = findAllByName(slime ?? new THREE.Group(), 'public-arena-level-label')[0];
    const background = findAllByName(scene, 'public-arena-background')[0] as
      | THREE.Mesh
      | undefined;
    const selfRing = findAllByName(scene, 'public-arena-self-ring').find(
      (ring) => ring.visible
    );

    expect(background?.userData['backgroundId']).toBe(activeBackground.id);
    expect(materialMap(background ?? null)).toBe(backgroundTexture);
    expect(backgroundTexture.repeat.x).toBeGreaterThan(1);
    expect(backgroundTexture.repeat.y).toBeGreaterThan(1);
    const hero = players.find((player) => player.userData['playerId'] === 'hero');

    expect(players).toHaveLength(4);
    expect(labels.map((label) => label.userData['level']).sort((a, b) => a - b)).toEqual([
      1,
      1,
      2,
      PUBLIC_ARENA_BOSS_LEVEL
    ]);
    expect(projectiles).toHaveLength(1);
    expect(projectiles[0]?.rotation.z).toBeCloseTo(Math.PI / 3);
    expect(boss?.userData['archetypeId']).toBe(PUBLIC_ARENA_BOSS_ARCHETYPE_ID);
    expect(materialMap(findSprite(boss))).toBe(textures[PUBLIC_ARENA_BOSS_ARCHETYPE_ID]);
    expect(slime?.userData['archetypeId']).toBe('slime-one-eye');
    expect(materialMap(findSprite(slime))).toBe(textures['slime-one-eye']);
    expect(hero?.userData['formKind']).toBe('player');
    expect(hero?.userData['archetypeId']).toBe(DEFAULT_PLAYER_VISUAL.archetypeId);
    expect(materialMap(findSprite(hero))).toBe(textures[DEFAULT_PLAYER_VISUAL.archetypeId]);
    expect(selfRing?.parent?.userData['playerId']).toBe('self');
    expect(crosshair?.visible).toBe(true);
    expect(crosshair?.position.x).toBe(12);
    expect(crosshair?.position.y).toBe(-6);
    expect(arcPreview?.visible).toBe(true);
    expect(arcPreview?.position.x).toBeCloseTo(12);
    expect(arcPreview?.position.y).toBeCloseTo(-6);
    expect(selfHpFill?.scale.x).toBeCloseTo(0.5);
    expect(selfLabel?.position.y).toBeGreaterThan(selfHpBar?.position.y ?? 0);

    const camera = backend.lastCamera();
    expect(camera.position.x).toBeCloseTo(1.5);
    expect(camera.position.y).toBeCloseTo(-4);

    predictedSnapshot = makePredictedSnapshot({ selfX: 6, selfY: -1, projectileX: 6.5, projectileY: -1 });
    renderer.render();

    const predictedSelf = findAllByName(scene, 'public-arena-player').find(
      (player) => player.userData['playerId'] === 'self'
    );
    const authoritativeOther = findAllByName(scene, 'public-arena-player').find(
      (player) => player.userData['playerId'] === 'other'
    );
    const predictedProjectile = findAllByName(scene, 'public-arena-projectile')[0];

    expect(predictedSelf?.position.x).toBeCloseTo(6);
    expect(predictedSelf?.position.y).toBeCloseTo(-1);
    expect(authoritativeOther?.position.x).toBeCloseTo(9);
    expect(authoritativeOther?.position.y).toBeCloseTo(-3);
    expect(predictedProjectile?.position.x).toBeCloseTo(6.5);
    expect(predictedProjectile?.position.y).toBeCloseTo(-1);

    predictedSnapshot = makePredictedSnapshot({ simTimeMs: 1050, selfX: 6.03, selfY: -1 });
    renderer.render();
    expect(predictedSelf?.position.x).toBeCloseTo(6.03);

    snapshot = { ...makeSnapshot(), simTimeMs: 1100 };
    pair = snapshotPair(snapshot);
    predictedSnapshot = makePredictedSnapshot({ simTimeMs: 1100, selfX: 10, selfY: -1 });
    renderer.render();
    expect(predictedSelf?.position.x).toBeCloseTo(10);

    snapshot = { ...makeSnapshot(), simTimeMs: 1150 };
    pair = snapshotPair(snapshot);
    predictedSnapshot = makePredictedSnapshot({ simTimeMs: 1150, selfX: 10, selfY: -1 });
    renderer.render();
    expect(predictedSelf?.position.x).toBeCloseTo(10);

    predictedSnapshot = null;
    snapshot = {
      ...makeSnapshot(),
      entities: makeSnapshot().entities.map((entity) =>
        entity.kind === 'player' && entity.playerId === 'self'
          ? {
              ...entity,
              weaponHud: entity.weaponHud === null ? null : { ...entity.weaponHud, selectedIndex: 1 }
            }
          : entity
      )
    };
    pair = snapshotPair(snapshot);
    renderer.render();
    expect(arcPreview?.visible).toBe(false);

    snapshot = {
      ...makeSnapshot(),
      entities: makeSnapshot().entities.filter(
        (entity) => entity.kind === 'player' && entity.playerId === 'self'
      )
    };
    pair = snapshotPair(snapshot);
    renderer.render();

    expect(findAllByName(backend.lastScene(), 'public-arena-player')).toHaveLength(1);
    expect(findAllByName(backend.lastScene(), 'public-arena-projectile')).toHaveLength(0);

    renderer.dispose();
    expect(backend.disposeCalls()).toBe(1);
  });

  it('renders Vibe Jam portal descriptors at stable world coordinates across viewport changes', () => {
    const backend = createRendererBackendHarness();
    const backgroundTexture = createBackgroundTexture();
    const activeBackground = requireActivePublicArenaBackground();
    const windowTarget = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 };
    const portals = [
      {
        kind: 'return' as const,
        x: -9.8,
        y: 0,
        width: 1.225,
        height: 2.2916666666666665
      }
    ];
    const renderer = createPublicArenaRenderer({
      canvas: makeCanvas(),
      arena: PUBLIC_ARENA_PRESENTATION_CONFIG.arena,
      selfId: 'self',
      renderScalePreset: 'medium',
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => snapshotPair(null),
      getPortalDescriptors: () => portals,
      windowTarget,
      createRendererBackend: backend.factory,
      loadBackgroundTexture(url, onLoad) {
        expect(url).toBe(activeBackground.imageUrl);
        onLoad?.(backgroundTexture);
        return backgroundTexture;
      }
    });

    renderer.render();

    let portal = findAllByName(backend.lastScene(), VIBE_JAM_PORTAL_GROUP_NAME)[0];
    expect(portal?.position.x).toBeCloseTo(-9.8);
    expect(portal?.position.y).toBeCloseTo(0);
    expect(portal?.scale.x).toBeCloseTo(1.225);
    expect(portal?.scale.y).toBeCloseTo(2.2916666666666665);
    expect(
      findAllByName(portal ?? new THREE.Group(), VIBE_JAM_PORTAL_RETURN_LABEL_NAME)[0]?.visible
    ).toBe(true);

    windowTarget.innerWidth = 640;
    windowTarget.innerHeight = 960;
    renderer.fitToWindow();
    renderer.render();

    portal = findAllByName(backend.lastScene(), VIBE_JAM_PORTAL_GROUP_NAME)[0];
    expect(portal?.position.x).toBeCloseTo(-9.8);
    expect(portal?.position.y).toBeCloseTo(0);

    renderer.dispose();
    expect(backend.disposeCalls()).toBe(1);
  });

  it('advances non-self interpolation from wall-clock time between snapshots', () => {
    const backend = createRendererBackendHarness();
    const receivedAtMs = 500;
    const prev = makeSnapshotWithEntities(
      [
        makePlayer({ id: 1, playerId: 'self', x: 0, y: 0 }),
        makeProjectile({ id: 20, ownerId: 2, x: 0, y: 0, spawnInputSequence: 8 })
      ],
      100
    );
    const curr = makeSnapshotWithEntities(
      [
        makePlayer({ id: 1, playerId: 'self', x: 0, y: 0 }),
        makeProjectile({
          id: 20,
          ownerId: 2,
          x: 10,
          y: 0,
          spawnInputSequence: 8
        })
      ],
      100 + SNAPSHOT_INTERVAL_MS
    );
    let pair: SnapshotPair = {
      prev,
      curr,
      currReceivedAtMs: receivedAtMs,
      nowMs: receivedAtMs
    };
    const renderer = createPublicArenaRenderer({
      canvas: makeCanvas(),
      arena: PUBLIC_ARENA_PRESENTATION_CONFIG.arena,
      selfId: 'self',
      renderScalePreset: 'medium',
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => pair,
      windowTarget: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 },
      createRendererBackend: backend.factory,
      loadBackgroundTexture: createLoadedBackgroundTexture
    });

    renderer.render();
    expect(firstProjectile(backend.lastScene())?.position.x).toBeCloseTo(0);

    pair = { ...pair, nowMs: receivedAtMs + SNAPSHOT_INTERVAL_MS / 2 };
    renderer.render();
    expect(firstProjectile(backend.lastScene())?.position.x).toBeCloseTo(5);

    pair = { ...pair, nowMs: receivedAtMs + SNAPSHOT_INTERVAL_MS };
    renderer.render();
    expect(firstProjectile(backend.lastScene())?.position.x).toBeCloseTo(10);

    renderer.dispose();
  });

  it('interpolates predicted self and own projectiles between predictor snapshots', () => {
    const backend = createRendererBackendHarness();
    const receivedAtMs = 500;
    const authoritativePair = snapshotPair(
      makeSnapshotWithEntities([makePlayer({ id: 1, playerId: 'self', x: 0, y: 0 })])
    );
    const predictedPrev = makeSnapshotWithEntities(
      [
        makePlayer({ id: 101, playerId: 'self', x: 0, y: 0 }),
        makeProjectile({ id: 201, ownerId: 101, x: 0, y: 0, spawnInputSequence: 42 })
      ],
      100
    );
    const predictedCurr = makeSnapshotWithEntities(
      [
        makePlayer({ id: 101, playerId: 'self', x: 6, y: 0 }),
        makeProjectile({ id: 201, ownerId: 101, x: 10, y: 0, spawnInputSequence: 42 }),
        makeProjectile({ id: 202, ownerId: 101, x: 20, y: 0, spawnInputSequence: 42 })
      ],
      100 + SIM_STEP_MS
    );
    let predictedPair: SnapshotPair = {
      prev: predictedPrev,
      curr: predictedCurr,
      currReceivedAtMs: receivedAtMs,
      nowMs: receivedAtMs
    };
    const renderer = createPublicArenaRenderer({
      canvas: makeCanvas(),
      arena: PUBLIC_ARENA_PRESENTATION_CONFIG.arena,
      selfId: 'self',
      renderScalePreset: 'medium',
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => authoritativePair,
      getPredictedSnapshotPair: () => predictedPair,
      windowTarget: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 },
      createRendererBackend: backend.factory,
      loadBackgroundTexture: createLoadedBackgroundTexture
    });

    renderer.render();
    expect(selfPlayerMesh(backend.lastScene())?.position.x).toBeCloseTo(0);
    expect(projectilePositions(backend.lastScene()).sort((a, b) => a - b)).toEqual([0, 20]);

    predictedPair = { ...predictedPair, nowMs: receivedAtMs + SIM_STEP_MS / 2 };
    renderer.render();
    expect(selfPlayerMesh(backend.lastScene())?.position.x).toBeCloseTo(3);
    expect(projectilePositions(backend.lastScene()).sort((a, b) => a - b)).toEqual([5, 20]);

    predictedPair = { ...predictedPair, nowMs: receivedAtMs + SIM_STEP_MS };
    renderer.render();
    expect(selfPlayerMesh(backend.lastScene())?.position.x).toBeCloseTo(6);
    expect(projectilePositions(backend.lastScene()).sort((a, b) => a - b)).toEqual([10, 20]);

    renderer.dispose();
  });

  it('uses sequence-group own-projectile fallback between predicted and authoritative snapshots', () => {
    const backend = createRendererBackendHarness();
    let predictedSnapshot: Snapshot | null = null;
    const pair: SnapshotPair = snapshotPair(
      makeSnapshotWithEntities([
        makePlayer({ id: 1, playerId: 'self', x: 0, y: 0 }),
        makeProjectile({ id: 31, ownerId: 1, x: 1, y: 0, spawnInputSequence: 42 }),
        makeProjectile({ id: 32, ownerId: 1, x: 2, y: 0, spawnInputSequence: 42 }),
        makeProjectile({ id: 33, ownerId: 1, x: 3, y: 0, spawnInputSequence: 42 })
      ])
    );
    const renderer = createPublicArenaRenderer({
      canvas: makeCanvas(),
      arena: PUBLIC_ARENA_PRESENTATION_CONFIG.arena,
      selfId: 'self',
      renderScalePreset: 'medium',
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => pair,
      getPredictedSnapshotPair: () => snapshotPair(predictedSnapshot),
      windowTarget: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 },
      createRendererBackend: backend.factory,
      loadBackgroundTexture: createLoadedBackgroundTexture
    });

    renderer.render();
    expect(projectilePositions(backend.lastScene())).toEqual([1, 2, 3]);

    predictedSnapshot = makeSnapshotWithEntities([
      makePlayer({ id: 101, playerId: 'self', x: 0, y: 0 }),
      makeProjectile({ id: 201, ownerId: 101, x: 10, y: 0, spawnInputSequence: 42 }),
      makeProjectile({ id: 202, ownerId: 101, x: 11, y: 0, spawnInputSequence: 42 }),
      makeProjectile({ id: 203, ownerId: 101, x: 12, y: 0, spawnInputSequence: 42 }),
      makeProjectile({ id: 204, ownerId: 101, x: 13, y: 0, spawnInputSequence: 42 }),
      makeProjectile({ id: 205, ownerId: 101, x: 14, y: 0, spawnInputSequence: 42 })
    ]);
    renderer.render();
    expect(projectilePositions(backend.lastScene())).toEqual([10, 11, 12, 13, 14]);

    renderer.dispose();
  });

  it('keeps predicted projectile render ids stable when held-fire projectiles despawn', () => {
    const backend = createRendererBackendHarness();
    const authoritativePair = snapshotPair(
      makeSnapshotWithEntities([makePlayer({ id: 1, playerId: 'self', x: 0, y: 0 })])
    );
    let predictedSnapshot = makeSnapshotWithEntities([
      makePlayer({ id: 101, playerId: 'self', x: 0, y: 0 }),
      makeProjectile({ id: 201, ownerId: 101, x: 10, y: 0, spawnInputSequence: 42 }),
      makeProjectile({ id: 202, ownerId: 101, x: 11, y: 0, spawnInputSequence: 42 })
    ]);
    const renderer = createPublicArenaRenderer({
      canvas: makeCanvas(),
      arena: PUBLIC_ARENA_PRESENTATION_CONFIG.arena,
      selfId: 'self',
      renderScalePreset: 'medium',
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => authoritativePair,
      getPredictedSnapshotPair: () => snapshotPair(predictedSnapshot),
      windowTarget: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 },
      createRendererBackend: backend.factory,
      loadBackgroundTexture: createLoadedBackgroundTexture
    });

    renderer.render();
    const retainedProjectile = findAllByName(backend.lastScene(), 'public-arena-projectile').find(
      (projectile) => projectile.position.x === 11
    );

    predictedSnapshot = makeSnapshotWithEntities([
      makePlayer({ id: 101, playerId: 'self', x: 0, y: 0 }),
      makeProjectile({ id: 202, ownerId: 101, x: 12, y: 0, spawnInputSequence: 42 })
    ]);
    renderer.render();

    const remainingProjectile = findAllByName(backend.lastScene(), 'public-arena-projectile')[0];
    expect(remainingProjectile).toBe(retainedProjectile);
    expect(remainingProjectile?.position.x).toBeCloseTo(12);

    renderer.dispose();
  });

  it('keeps authoritative own projectiles with null spawn sequence visible', () => {
    const backend = createRendererBackendHarness();
    const pair = snapshotPair(
      makeSnapshotWithEntities([
        makePlayer({ id: 1, playerId: 'self', x: 0, y: 0 }),
        makeProjectile({ id: 31, ownerId: 1, x: 1, y: 0, spawnInputSequence: null })
      ])
    );
    const predictedSnapshot = makeSnapshotWithEntities([
      makePlayer({ id: 101, playerId: 'self', x: 0, y: 0 }),
      makeProjectile({ id: 201, ownerId: 101, x: 10, y: 0, spawnInputSequence: 42 })
    ]);
    const renderer = createPublicArenaRenderer({
      canvas: makeCanvas(),
      arena: PUBLIC_ARENA_PRESENTATION_CONFIG.arena,
      selfId: 'self',
      renderScalePreset: 'medium',
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => pair,
      getPredictedSnapshotPair: () => snapshotPair(predictedSnapshot),
      windowTarget: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 },
      createRendererBackend: backend.factory,
      loadBackgroundTexture: createLoadedBackgroundTexture
    });

    renderer.render();
    expect(projectilePositions(backend.lastScene())).toEqual([1, 10]);

    renderer.dispose();
  });

  it('snaps self transition presentation from the predicted snapshot', () => {
    const backend = createRendererBackendHarness();
    const pair = snapshotPair(
      makeSnapshotWithEntities([
        makePlayer({ id: 1, playerId: 'self', x: 0, y: 0, formArchetypeId: 'slime-one-eye' })
      ])
    );
    const predictedSnapshot = makeSnapshotWithEntities([
      makePlayer({
        id: 101,
        playerId: 'self',
        x: 8,
        y: 0,
        formArchetypeId: PUBLIC_ARENA_BOSS_ARCHETYPE_ID
      })
    ]);
    const renderer = createPublicArenaRenderer({
      canvas: makeCanvas(),
      arena: PUBLIC_ARENA_PRESENTATION_CONFIG.arena,
      selfId: 'self',
      renderScalePreset: 'medium',
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => pair,
      getPredictedSnapshotPair: () => snapshotPair(predictedSnapshot),
      windowTarget: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 },
      createRendererBackend: backend.factory,
      loadBackgroundTexture: createLoadedBackgroundTexture
    });

    renderer.render();

    const self = findAllByName(backend.lastScene(), 'public-arena-player').find(
      (player) => player.userData['playerId'] === 'self'
    );
    expect(self?.position.x).toBeCloseTo(8);
    expect(self?.userData['formKind']).toBe('boss');

    renderer.dispose();
  });
});

function requireActivePublicArenaBackground() {
  const background = PUBLIC_ARENA_PRESENTATION_CONFIG.backgrounds.find(
    (entry) => entry.id === PUBLIC_ARENA_PRESENTATION_CONFIG.activeBackgroundId
  );
  if (background === undefined) {
    throw new Error('expected public arena active background');
  }
  return background;
}

function makeSnapshot(): Snapshot {
  return {
    simTimeMs: 1000,
    entities: [
      {
        id: 1,
        kind: 'player',
        playerId: 'self',
        x: 8,
        y: -4,
        hp: 10,
        maxHp: 20,
        state: 'alive',
        formArchetypeId: 'slime-one-eye',
        weaponHud: makeWeaponHud(0),
        statusEffects: []
      },
      {
        id: 2,
        kind: 'player',
        playerId: 'other',
        x: 9,
        y: -3,
        hp: 24,
        maxHp: 24,
        state: 'alive',
        formArchetypeId: 'slime-hornling',
        weaponHud: makeWeaponHud(0),
        statusEffects: []
      },
      {
        id: 3,
        kind: 'player',
        playerId: 'boss',
        x: 11,
        y: -2,
        hp: 180,
        maxHp: 180,
        state: 'alive',
        formArchetypeId: PUBLIC_ARENA_BOSS_ARCHETYPE_ID,
        weaponHud: null,
        statusEffects: []
      },
      {
        id: 4,
        kind: 'player',
        playerId: 'hero',
        x: 7,
        y: -5,
        hp: 5,
        maxHp: 5,
        state: 'alive',
        formArchetypeId: null,
        weaponHud: null,
        statusEffects: []
      },
      {
        id: 5,
        kind: 'projectile',
        ownerKind: 'player',
        ownerId: 1,
        weaponArchetypeId: 'rock-thrower',
        originX: 8,
        originY: -4,
        x: 8.8,
        y: -3.2,
        size: { width: 0.42, height: 0.42 },
        state: 'flying',
        visualState: {
          angleRadians: Math.PI / 3,
          spinRadians: 0,
          pulsePhase: 0
        },
        explosionRadius: null,
        detonateAtSimMs: null,
        arcEnd: { x: 12, y: -6 },
        spawnInputSequence: 4
      }
    ],
    encounter: null,
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null,
    lastInputSequence: {}
  };
}

function makePredictedSnapshot(
  overrides: Partial<{
    simTimeMs: number;
    selfX: number;
    selfY: number;
    projectileX: number;
    projectileY: number;
  }> = {}
): Snapshot {
  const simTimeMs = overrides.simTimeMs ?? 1000;
  const selfX = overrides.selfX ?? 6;
  const selfY = overrides.selfY ?? -1;
  const projectileX = overrides.projectileX ?? selfX + 0.5;
  const projectileY = overrides.projectileY ?? selfY;
  return {
    ...makeSnapshot(),
    simTimeMs,
    entities: [
      {
        id: 101,
        kind: 'player',
        playerId: 'self',
        x: selfX,
        y: selfY,
        hp: 10,
        maxHp: 20,
        state: 'alive',
        formArchetypeId: 'slime-one-eye',
        weaponHud: makeWeaponHud(0),
        statusEffects: []
      },
      {
        id: 102,
        kind: 'projectile',
        ownerKind: 'player',
        ownerId: 101,
        weaponArchetypeId: 'rock-thrower',
        originX: selfX,
        originY: selfY,
        x: projectileX,
        y: projectileY,
        size: { width: 0.42, height: 0.42 },
        state: 'flying',
        visualState: {
          angleRadians: Math.PI / 3,
          spinRadians: 0,
          pulsePhase: 0
        },
        explosionRadius: null,
        detonateAtSimMs: null,
        arcEnd: { x: 12, y: -6 },
        spawnInputSequence: 4
      }
    ]
  };
}

type TestPlayer = Extract<Snapshot['entities'][number], { kind: 'player' }>;
type TestProjectile = Extract<Snapshot['entities'][number], { kind: 'projectile' }>;

function snapshotPair(snapshot: Snapshot | null): SnapshotPair {
  return {
    prev: null,
    curr: snapshot,
    currReceivedAtMs: 0,
    nowMs: snapshot?.simTimeMs ?? 0
  };
}

function makeSnapshotWithEntities(
  entities: ReadonlyArray<Snapshot['entities'][number]>,
  simTimeMs = 1000
): Snapshot {
  return {
    simTimeMs,
    entities,
    encounter: null,
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null,
    lastInputSequence: {}
  };
}

function makePlayer(overrides: Partial<TestPlayer> = {}): TestPlayer {
  return {
    id: 1,
    kind: 'player',
    playerId: 'self',
    x: 0,
    y: 0,
    hp: 10,
    maxHp: 20,
    state: 'alive',
    formArchetypeId: null,
    weaponHud: makeWeaponHud(0),
    statusEffects: [],
    ...overrides
  };
}

function makeProjectile(overrides: Partial<TestProjectile> = {}): TestProjectile {
  return {
    id: 100,
    kind: 'projectile',
    ownerKind: 'player',
    ownerId: 1,
    weaponArchetypeId: 'rock-thrower',
    originX: 0,
    originY: 0,
    x: 0,
    y: 0,
    size: { width: 0.42, height: 0.42 },
    state: 'flying',
    visualState: {
      angleRadians: 0,
      spinRadians: 0,
      pulsePhase: 0
    },
    explosionRadius: null,
    detonateAtSimMs: null,
    arcEnd: null,
    spawnInputSequence: null,
    ...overrides
  };
}

function makeWeaponHud(selectedIndex: number) {
  return {
    selectedIndex,
    weapons: [
      {
        index: 0,
        weaponArchetypeId: 'rock-thrower',
        cooldownStartedAtSimMs: 0,
        cooldownReadyAtSimMs: 0,
        modifiers: [],
        timedEffects: []
      },
      {
        index: 1,
        weaponArchetypeId: 'pistol',
        cooldownStartedAtSimMs: 0,
        cooldownReadyAtSimMs: 0,
        modifiers: [],
        timedEffects: []
      }
    ]
  };
}

function createSpriteTextures(): TextureMap {
  return {
    'slime-one-eye': new THREE.Texture(),
    'slime-hornling': new THREE.Texture(),
    [PUBLIC_ARENA_BOSS_ARCHETYPE_ID]: new THREE.Texture(),
    'rock-thrower': new THREE.Texture(),
    [DEFAULT_PLAYER_VISUAL.archetypeId]: new THREE.Texture()
  };
}

function createBackgroundTexture(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.image = { width: 480, height: 270 } as HTMLImageElement;
  return texture;
}

function createLoadedBackgroundTexture(
  _url: string,
  onLoad?: (texture: THREE.Texture) => void
): THREE.Texture {
  const texture = createBackgroundTexture();
  onLoad?.(texture);
  return texture;
}

function makeCanvas(): HTMLCanvasElement {
  return {
    style: new FakeStyle(),
    clientWidth: 1280,
    clientHeight: 720
  } as unknown as HTMLCanvasElement;
}

function findAllByName(root: THREE.Object3D, name: string): THREE.Object3D[] {
  const matches: THREE.Object3D[] = [];
  root.traverse((child) => {
    if (child.name === name) {
      matches.push(child);
    }
  });
  return matches;
}

function findSprite(player: THREE.Object3D | undefined): THREE.Mesh | null {
  if (player === undefined) return null;
  const sprite = player.children.find(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.name.endsWith('sprite')
  );
  return sprite ?? null;
}

function materialMap(mesh: THREE.Mesh | null): THREE.Texture | null {
  if (mesh === null || Array.isArray(mesh.material)) return null;
  const material = mesh.material;
  return material instanceof THREE.MeshBasicMaterial ? material.map : null;
}

function firstProjectile(scene: THREE.Scene): THREE.Object3D | undefined {
  return findAllByName(scene, 'public-arena-projectile')[0];
}

function selfPlayerMesh(scene: THREE.Scene): THREE.Object3D | undefined {
  return findAllByName(scene, 'public-arena-player').find(
    (player) => player.userData['playerId'] === 'self'
  );
}

function projectilePositions(scene: THREE.Scene): number[] {
  return findAllByName(scene, 'public-arena-projectile').map((projectile) =>
    Number(projectile.position.x.toFixed(6))
  );
}
