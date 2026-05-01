import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { SnapshotPair } from '../sim/SimWorkerHost';

import { BOSS_GARGOYLE } from '../../shared/content/bosses';
import { HEAL_ORB } from '../../shared/content/drops';
import { SLIME_BUG } from '../../shared/content/enemies';
import { PET_01 } from '../../shared/content/pets';
import { TRAINING_PLAYER } from '../../shared/content/players';
import { BOMB_PLACER, GRENADE_LAUNCHER, PISTOL, ROCK_THROWER } from '../../shared/content/weapons';
import type { SessionDefinition } from '../../shared/session';
import { PX_PER_WU } from '../../shared/sprite/spriteScale';
import type { CompanionSnapshot } from '../../shared/snapshot';
import type { WeaponHudSnapshot } from '../../shared/snapshot';
import { SIM_STEP_MS, SNAPSHOT_INTERVAL_MS } from '../../shared/timing';
import type { VibeJamPortalDescriptor } from '../VibeJamPortalController';
import { ARC_PREVIEW_OUTLINE_NAME } from './arcPreview';
import { DROP_VISUALS } from './dropVisuals';
import { LANDING_TELEGRAPH_NAME } from './landingTelegraph';
import { DEFAULT_PLAYER_VISUAL } from './playerVisuals';
import { PROJECTILE_VISUALS } from './projectileVisuals';
import { createRenderer } from './Renderer';
import type { TextureMap } from './spritePreload';
import { createVisibleAreaCamera } from '../visibleArea';

const AIM_RING_OUTLINE_COLOR = 0xd97706;
const PROJECTILE_RADIUS_OUTLINE_OPACITY = 0.54;
const CROSSHAIR_OPACITY = 0.78;
const CROSSHAIR_OUTLINE_OPACITY = 1;
const CROSSHAIR_OUTLINE_RENDER_ORDER = 20;
const CROSSHAIR_RENDER_ORDER = 21;
const PORTAL_GROUP_NAME = 'vibe-jam-portal';
const PORTAL_INTERIOR_NAME = 'vibe-jam-portal-interior';
const PORTAL_OUTLINE_NAME = 'vibe-jam-portal-outline';
const PORTAL_RETURN_LABEL_NAME = 'vibe-jam-portal-return-label';
const PORTAL_INTERIOR_COLOR = 0x000000;

type FakeRendererOp =
  | Readonly<{ kind: 'pixelRatio'; value: number }>
  | Readonly<{ kind: 'size'; width: number; height: number; updateStyle: boolean }>
  | Readonly<{ kind: 'render' }>
  | Readonly<{ kind: 'dispose' }>;

function createCanvasHarness(): HTMLCanvasElement {
  return {
    style: {
      width: '',
      height: '',
      imageRendering: ''
    }
  } as HTMLCanvasElement;
}

function createRendererBackendHarness() {
  const ops: FakeRendererOp[] = [];
  let lastScene: THREE.Scene | null = null;
  let lastCamera: THREE.Camera | null = null;

  return {
    factory() {
      return {
        setPixelRatio(value: number): void {
          ops.push({ kind: 'pixelRatio', value });
        },
        setSize(width: number, height: number, updateStyle = true): void {
          ops.push({ kind: 'size', width, height, updateStyle });
        },
        render(scene: THREE.Scene, camera: THREE.Camera): void {
          lastScene = scene;
          lastCamera = camera;
          ops.push({ kind: 'render' });
        },
        dispose(): void {
          ops.push({ kind: 'dispose' });
        }
      };
    },
    ops,
    lastScene(): THREE.Scene | null {
      return lastScene;
    },
    lastCamera(): THREE.Camera | null {
      return lastCamera;
    },
    reset(): void {
      ops.length = 0;
    }
  };
}

function createEmptySnapshotPair(): SnapshotPair {
  return {
    prev: null,
    curr: null,
    currReceivedAtMs: 0,
    nowMs: 0
  };
}

function createSnapshotPair(snapshot: SnapshotPair['curr']): SnapshotPair {
  return {
    prev: null,
    curr: snapshot,
    currReceivedAtMs: 0,
    nowMs: snapshot?.simTimeMs ?? 0
  };
}

type SnapshotEntity = NonNullable<SnapshotPair['curr']>['entities'][number];
type TestPlayerSnapshot = Omit<
  Extract<SnapshotEntity, { kind: 'player' }>,
  'playerId' | 'state' | 'formArchetypeId' | 'weaponHud' | 'statusEffects'
> &
  Partial<
    Pick<
      Extract<SnapshotEntity, { kind: 'player' }>,
      'playerId' | 'state' | 'formArchetypeId' | 'weaponHud' | 'statusEffects'
    >
  >;
type TestProjectileSnapshot = Omit<
  Extract<SnapshotEntity, { kind: 'projectile' }>,
  'ownerId' | 'spawnInputSequence'
> &
  Partial<Pick<Extract<SnapshotEntity, { kind: 'projectile' }>, 'ownerId' | 'spawnInputSequence'>>;
type SnapshotEntities = ReadonlyArray<SnapshotEntity | TestPlayerSnapshot | TestProjectileSnapshot>;

function createSnapshot(
  entities: SnapshotEntities,
  overrides: Readonly<{ simTimeMs?: number; weaponHud?: WeaponHudSnapshot | null }> = {}
): NonNullable<SnapshotPair['curr']> {
  return {
    simTimeMs: overrides.simTimeMs ?? 0,
    entities: normalizeSnapshotEntities(entities, overrides.weaponHud),
    encounter: null,
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null,
    lastInputSequence: {}
  };
}

function normalizeSnapshotEntities(
  entities: SnapshotEntities,
  weaponHudOverride: WeaponHudSnapshot | null | undefined
): NonNullable<SnapshotPair['curr']>['entities'] {
  return entities.map((entity) => {
    if (entity.kind === 'projectile') {
      return {
        ...entity,
        ownerId: entity.ownerId ?? 1,
        spawnInputSequence: entity.spawnInputSequence ?? null
      };
    }
    if (entity.kind !== 'player') return entity;
    return {
      ...entity,
      playerId: entity.playerId ?? 'player',
      state: entity.state ?? 'alive',
      formArchetypeId: entity.formArchetypeId ?? null,
      weaponHud: entity.weaponHud ?? weaponHudOverride ?? null,
      statusEffects: entity.statusEffects ?? []
    };
  });
}

function createSnapshotPairWithEntities(entities: SnapshotEntities): SnapshotPair {
  return {
    prev: null,
    curr: createSnapshot(entities),
    currReceivedAtMs: 0,
    nowMs: 0
  };
}

function createSpriteTextures(
  overrides: Readonly<Record<string, THREE.Texture>> = {}
): TextureMap {
  return {
    [DEFAULT_PLAYER_VISUAL.archetypeId]: new THREE.Texture(),
    ...createTextureEntries(PROJECTILE_VISUALS),
    ...createTextureEntries(DROP_VISUALS),
    ...overrides
  };
}

function createTextureEntries(
  visuals: Readonly<Record<string, unknown>>
): Readonly<Record<string, THREE.Texture>> {
  return Object.fromEntries(Object.keys(visuals).map((id) => [id, new THREE.Texture()]));
}

function createRenderSession(
  overrides: Partial<Pick<SessionDefinition, 'backgrounds' | 'encounters' | 'players'>> = {}
): Pick<SessionDefinition, 'backgrounds' | 'encounters' | 'players'> {
  return {
    backgrounds: [],
    encounters: [],
    players: [{ id: 'hero-training', ...TRAINING_PLAYER, loadout: null, companion: null }],
    ...overrides
  };
}

function createEncounter(
  id: string,
  backgroundId: string | null
): SessionDefinition['encounters'][number] {
  return {
    id,
    type: 'wave',
    backgroundId,
    introDurationMs: 0,
    name: null,
    text: null,
    spawnPlan: { kind: 'empty' },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'never', next: 'sequential' },
    tuning: null
  };
}

function findMeshWithMaterialMap(
  scene: THREE.Scene | null,
  texture: THREE.Texture
): THREE.Mesh | null {
  if (scene === null) return null;
  return scene.children.find((child): child is THREE.Mesh => {
    if (!(child instanceof THREE.Mesh)) return false;
    const material = child.material;
    if (Array.isArray(material)) return false;
    return material instanceof THREE.MeshBasicMaterial && material.map === texture;
  }) ?? null;
}

function findMeshesWithMaterialMap(
  scene: THREE.Scene | null,
  texture: THREE.Texture
): THREE.Mesh[] {
  if (scene === null) return [];
  return scene.children.filter((child): child is THREE.Mesh => {
    if (!(child instanceof THREE.Mesh)) return false;
    const material = child.material;
    if (Array.isArray(material)) return false;
    return material instanceof THREE.MeshBasicMaterial && material.map === texture;
  });
}

function findChildMeshByName(
  root: THREE.Object3D | null | undefined,
  name: string
): THREE.Mesh | null {
  if (root === null || root === undefined) return null;
  let found: THREE.Mesh | null = null;
  root.traverse((child) => {
    if (found !== null) return;
    if (child instanceof THREE.Mesh && child.name === name) {
      found = child;
    }
  });
  return found;
}

function findSlimeBlobMeshes(scene: THREE.Scene | null, color: number): THREE.Mesh[] {
  if (scene === null) return [];
  return scene.children.filter((child): child is THREE.Mesh => {
    if (!(child instanceof THREE.Mesh)) return false;
    if (!(child.geometry instanceof THREE.ShapeGeometry)) return false;
    const material = child.material;
    if (Array.isArray(material) || !(material instanceof THREE.MeshBasicMaterial)) return false;
    return material.color.getHex() === color;
  });
}

function findShaderMeshWithMap(scene: THREE.Scene | null, texture: THREE.Texture): THREE.Mesh | null {
  if (scene === null) return null;
  return scene.children.find((child): child is THREE.Mesh => {
    if (!(child instanceof THREE.Mesh)) return false;
    const material = child.material;
    if (Array.isArray(material) || !(material instanceof THREE.ShaderMaterial)) return false;
    return material.uniforms.uMap?.value === texture;
  }) ?? null;
}

function findProjectileMesh(scene: THREE.Scene | null): THREE.Mesh | null {
  if (scene === null) return null;
  return scene.children.find((child): child is THREE.Mesh => {
    if (!(child instanceof THREE.Mesh)) return false;
    if (!(child.geometry instanceof THREE.PlaneGeometry)) return false;
    const material = child.material;
    if (Array.isArray(material) || !(material instanceof THREE.MeshBasicMaterial)) return false;
    return material.map !== null && child.position.z === 0.05;
  }) ?? null;
}

function findArcPreviewMesh(scene: THREE.Scene | null): THREE.Mesh | null {
  if (scene === null) return null;
  return scene.children.find((child): child is THREE.Mesh => {
    return child instanceof THREE.Mesh && child.geometry instanceof THREE.RingGeometry;
  }) ?? null;
}

function findLandingTelegraphMesh(scene: THREE.Scene | null): THREE.Mesh | null {
  if (scene === null) return null;
  return scene.children.find((child): child is THREE.Mesh => {
    return child instanceof THREE.Mesh && child.name === LANDING_TELEGRAPH_NAME;
  }) ?? null;
}

function findCrosshairGroup(scene: THREE.Scene | null): THREE.Group | null {
  if (scene === null) return null;
  return scene.children.find((child): child is THREE.Group => {
    return child instanceof THREE.Group && child.position.z === 0.1;
  }) ?? null;
}

function findPortalGroup(scene: THREE.Scene | null): THREE.Group | null {
  return findPortalGroups(scene)[0] ?? null;
}

function findPortalGroups(scene: THREE.Scene | null): THREE.Group[] {
  if (scene === null) return [];
  return scene.children.filter((child): child is THREE.Group => {
    return child instanceof THREE.Group && child.name === PORTAL_GROUP_NAME;
  });
}

function findPortalPart(
  group: THREE.Group | null,
  name: string
): THREE.Mesh | null {
  if (group === null) return null;
  return group.children.find((child): child is THREE.Mesh => {
    return child instanceof THREE.Mesh && child.name === name;
  }) ?? null;
}

function setTextureImageSize(texture: THREE.Texture, width: number, height: number): void {
  Object.defineProperty(texture, 'image', {
    value: { width, height },
    configurable: true
  });
}

function companionSnapshot(
  overrides: Partial<CompanionSnapshot> = {}
): CompanionSnapshot {
  return {
    id: 7,
    kind: 'companion',
    ownerPlayerId: 'hero-training',
    petArchetypeId: PET_01.id,
    x: 2,
    y: -1,
    hp: 3,
    maxHp: 6,
    state: 'alive',
    mode: 'alert',
    rescueProgress: null,
    targetId: 2,
    ...overrides
  };
}

function playerSnapshot(
  overrides: Partial<TestPlayerSnapshot> & { id: number }
): TestPlayerSnapshot {
  return {
    kind: 'player',
    x: 0,
    y: 0,
    hp: 5,
    maxHp: 5,
    ...overrides
  };
}

function projectileSnapshot(
  overrides: Partial<Extract<SnapshotEntity, { kind: 'projectile' }>> & { id: number; x: number }
): TestProjectileSnapshot {
  return {
    kind: 'projectile',
    ownerKind: 'player',
    ownerId: 1,
    weaponArchetypeId: PISTOL.id,
    originX: overrides.x - 10,
    originY: overrides.y ?? 0,
    y: 0,
    size: PISTOL.projectile.size,
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

function projectileXPositions(scene: THREE.Scene | null, texture: THREE.Texture): number[] {
  return findMeshesWithMaterialMap(scene, texture)
    .map((mesh) => mesh.position.x)
    .sort((a, b) => a - b);
}

describe('createRenderer', () => {
  it('applies the low preset with quarter-resolution backing pixels and pixelated output on init', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();

    createRenderer({
      canvas,
      renderScalePreset: 'low',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: createEmptySnapshotPair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    expect(canvas.style.width).toBe('800px');
    expect(canvas.style.height).toBe('450px');
    expect(canvas.style.imageRendering).toBe('pixelated');
    expect(backend.ops).toEqual([
      { kind: 'pixelRatio', value: 1 },
      { kind: 'size', width: 200, height: 113, updateStyle: false }
    ]);
  });

  it('uses no renderer debug HUD by default', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: createEmptySnapshotPair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory
    });

    backend.reset();
    renderer.render();
    renderer.dispose();

    expect(backend.ops).toEqual([{ kind: 'render' }, { kind: 'dispose' }]);
  });

  it('applies the high preset through the renderer wrapper without changing CSS canvas size', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: createEmptySnapshotPair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 4
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    backend.reset();
    renderer.applyScalePolicy('high');

    expect(canvas.style.width).toBe('800px');
    expect(canvas.style.height).toBe('450px');
    expect(canvas.style.imageRendering).toBe('auto');
    expect(backend.ops).toEqual([
      { kind: 'pixelRatio', value: 2 },
      { kind: 'size', width: 800, height: 450, updateStyle: false }
    ]);
  });

  it('accepts runtime events through the renderer event sink', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: createEmptySnapshotPair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 1
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    expect(() => renderer.handleEvent({ kind: 'sessionStart', simTime: 0 })).not.toThrow();
  });

  it('renders slime impact droplets as generated irregular blob meshes', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => ({
        ...createEmptySnapshotPair(),
        nowMs: 1000
      }),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 1
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.handleEvent({
      kind: 'hit',
      simTime: 0,
      projectileId: 1,
      ownerId: 1,
      ownerKind: 'player',
      targetId: 2,
      targetKind: 'enemy',
      targetArchetypeId: SLIME_BUG.id,
      weaponArchetypeId: 'pistol',
      damage: 1,
      impactDirX: 1,
      impactDirY: 0,
      x: 2,
      y: 3
    });
    renderer.render();

    const blobs = findSlimeBlobMeshes(backend.lastScene(), SLIME_BUG.color);
    expect(blobs.length).toBeGreaterThan(0);
    expect(blobs[0]?.geometry).toBeInstanceOf(THREE.ShapeGeometry);
    expect(blobs[0]?.position.z).toBeLessThan(0);
    const material = blobs[0]?.material;
    expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
    if (!(material instanceof THREE.MeshBasicMaterial)) throw new Error('expected droplet material');
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeGreaterThan(0);
    expect(material.opacity).toBeLessThan(1);
  });

  it('renders death ghosts from event data even when the dead entity is absent from snapshots', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const enemyTexture = new THREE.Texture();
    let pair: SnapshotPair = {
      ...createEmptySnapshotPair(),
      curr: createSnapshot([]),
      nowMs: 700
    };
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({
        [SLIME_BUG.id]: enemyTexture
      }),
      getSnapshotPair: () => pair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 1
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.handleEvent({
      kind: 'death',
      simTime: 0,
      entityId: 2,
      entityKind: 'enemy',
      archetypeId: SLIME_BUG.id,
      weaponArchetypeId: 'pistol',
      impactDirX: 1,
      impactDirY: 0,
      killerId: null,
      x: 2,
      y: 3
    });
    renderer.render();

    const ghostMesh = findShaderMeshWithMap(backend.lastScene(), enemyTexture);
    const material = ghostMesh?.material;
    expect(ghostMesh).not.toBeNull();
    expect(ghostMesh?.position.x).toBeGreaterThan(2);
    expect(ghostMesh?.position.y).toBeGreaterThan(3);
    expect(ghostMesh?.scale.x).toBeGreaterThan(1);
    expect(material).toBeInstanceOf(THREE.ShaderMaterial);
    expect((material as THREE.ShaderMaterial).uniforms.uOpacity?.value).toBeLessThan(1);
    expect((material as THREE.ShaderMaterial).uniforms.uOpacity?.value).toBeLessThan(0.42);
    expect((material as THREE.ShaderMaterial).fragmentShader).toContain('dot(texel.rgb');

    pair = { ...pair, nowMs: 2700 };
    renderer.render();
    expect(findShaderMeshWithMap(backend.lastScene(), enemyTexture)).toBeNull();
  });

  it('reapplies the current preset after resize in pixelRatio -> size order', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const windowTarget = {
      innerWidth: 800,
      innerHeight: 600,
      devicePixelRatio: 2
    };
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: createEmptySnapshotPair,
      windowTarget,
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.applyScalePolicy('low');
    backend.reset();

    windowTarget.innerWidth = 1024;
    windowTarget.innerHeight = 768;
    renderer.fitToWindow();

    expect(canvas.style.width).toBe('1024px');
    expect(canvas.style.height).toBe('576px');
    expect(canvas.style.imageRendering).toBe('pixelated');
    expect(backend.ops).toEqual([
      { kind: 'pixelRatio', value: 1 },
      { kind: 'size', width: 256, height: 144, updateStyle: false }
    ]);
  });

  it('fits the canvas to the active visible area instead of the full arena', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const windowTarget = {
      innerWidth: 1200,
      innerHeight: 600,
      devicePixelRatio: 1
    };
    createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 32, height: 18 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      visibleAreaCamera: createVisibleAreaCamera({
        arena: { width: 32, height: 18 },
        profile: 'mobile',
        effectiveViewport: { width: 1200, height: 600 },
        playerPosition: { x: 0, y: 0 }
      }),
      getSnapshotPair: createEmptySnapshotPair,
      windowTarget,
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    expect(canvas.style.width).toBe('1200px');
    expect(canvas.style.height).toBe('600px');
  });

  it('renders through a visible-area camera that follows the player and stays inside arena bounds', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const visibleAreaCamera = createVisibleAreaCamera({
      arena: { width: 32, height: 18 },
      profile: 'mobile',
      effectiveViewport: { width: 1200, height: 600 },
      playerPosition: { x: 0, y: 0 }
    });
    let pair: SnapshotPair = {
      prev: null,
      curr: createSnapshot([{ id: 1, kind: 'player', x: 12, y: 0, hp: 5, maxHp: 5 }]),
      currReceivedAtMs: 0,
      nowMs: 0
    };
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 32, height: 18 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      visibleAreaCamera,
      getSnapshotPair: () => pair,
      windowTarget: {
        innerWidth: 1200,
        innerHeight: 600,
        devicePixelRatio: 1
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();
    pair = { ...pair, nowMs: 280 };
    renderer.render();

    const camera = backend.lastCamera();
    expect(camera).toBeInstanceOf(THREE.OrthographicCamera);
    const orthoCamera = camera as THREE.OrthographicCamera;
    expect(orthoCamera.right - orthoCamera.left).toBeCloseTo(24, 6);
    expect(orthoCamera.top - orthoCamera.bottom).toBeCloseTo(12, 6);
    expect(orthoCamera.position.x).toBeGreaterThan(0);
    expect(orthoCamera.position.x).toBeLessThanOrEqual(4);
    expect(orthoCamera.position.y).toBe(0);
  });

  it('renders snapshots with sprite-backed enemy and boss entities from preloaded textures', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({
        [SLIME_BUG.id]: new THREE.Texture(),
        [BOSS_GARGOYLE.id]: new THREE.Texture()
      }),
      getSnapshotPair: () =>
        createSnapshotPairWithEntities([
          { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
          {
            id: 2,
            kind: 'enemy',
            archetypeId: SLIME_BUG.id,
            x: 1,
            y: 1,
            hp: 2,
            maxHp: 2
          },
          {
            id: 3,
            kind: 'boss',
            archetypeId: BOSS_GARGOYLE.id,
            x: -1,
            y: -1,
            hp: 10,
            maxHp: 10,
            phaseIndex: 0,
            phaseId: 'phase-0',
            activeAttackIds: []
          }
        ]),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    backend.reset();
    renderer.render();

    expect(backend.ops).toEqual([{ kind: 'render' }]);
  });

  it('composes online self prediction directly while interpolating non-self entities by wall-clock time', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const playerTexture = new THREE.Texture();
    const projectileTexture = new THREE.Texture();
    const receivedAtMs = 500;
    const prev = createSnapshot(
      [
        playerSnapshot({ id: 1, playerId: 'self', x: 0, y: 0 }),
        projectileSnapshot({ id: 20, ownerId: 2, x: 0, spawnInputSequence: 8 })
      ],
      { simTimeMs: 100 }
    );
    const curr = createSnapshot(
      [
        playerSnapshot({ id: 1, playerId: 'self', x: 0, y: 0 }),
        projectileSnapshot({ id: 20, ownerId: 2, x: 10, spawnInputSequence: 8 })
      ],
      { simTimeMs: 100 + SNAPSHOT_INTERVAL_MS }
    );
    const predicted = createSnapshot([
      playerSnapshot({ id: 101, playerId: 'self', x: 12, y: -1 })
    ]);
    let pair: SnapshotPair = {
      prev,
      curr,
      currReceivedAtMs: receivedAtMs,
      nowMs: receivedAtMs
    };
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({
        [DEFAULT_PLAYER_VISUAL.archetypeId]: playerTexture,
        [PISTOL.id]: projectileTexture
      }),
      getSnapshotPair: () => pair,
      getPredictedSnapshotPair: () => createSnapshotPair(predicted),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();
    expect(findMeshWithMaterialMap(backend.lastScene(), playerTexture)?.position.x).toBeCloseTo(12);
    expect(findMeshWithMaterialMap(backend.lastScene(), playerTexture)?.position.y).toBeCloseTo(-1);
    expect(projectileXPositions(backend.lastScene(), projectileTexture)[0]).toBeCloseTo(0);

    pair = { ...pair, nowMs: receivedAtMs + SNAPSHOT_INTERVAL_MS / 2 };
    renderer.render();
    expect(findMeshWithMaterialMap(backend.lastScene(), playerTexture)?.position.x).toBeCloseTo(12);
    expect(projectileXPositions(backend.lastScene(), projectileTexture)[0]).toBeCloseTo(5);

    pair = { ...pair, nowMs: receivedAtMs + SNAPSHOT_INTERVAL_MS };
    renderer.render();
    expect(projectileXPositions(backend.lastScene(), projectileTexture)[0]).toBeCloseTo(10);
  });

  it('interpolates online predicted self and own projectiles between predictor snapshots', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const playerTexture = new THREE.Texture();
    const projectileTexture = new THREE.Texture();
    const receivedAtMs = 500;
    const pair = createSnapshotPairWithEntities([
      playerSnapshot({ id: 1, playerId: 'self', x: 0, y: 0 })
    ]);
    const predictedPrev = createSnapshot(
      [
        playerSnapshot({ id: 101, playerId: 'self', x: 0, y: 0 }),
        projectileSnapshot({ id: 201, ownerId: 101, x: 0, spawnInputSequence: 42 })
      ],
      { simTimeMs: 100 }
    );
    const predictedCurr = createSnapshot(
      [
        playerSnapshot({ id: 101, playerId: 'self', x: 6, y: 0 }),
        projectileSnapshot({ id: 201, ownerId: 101, x: 10, spawnInputSequence: 42 }),
        projectileSnapshot({ id: 202, ownerId: 101, x: 20, spawnInputSequence: 42 })
      ],
      { simTimeMs: 100 + SIM_STEP_MS }
    );
    let predictedPair: SnapshotPair = {
      prev: predictedPrev,
      curr: predictedCurr,
      currReceivedAtMs: receivedAtMs,
      nowMs: receivedAtMs
    };
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({
        [DEFAULT_PLAYER_VISUAL.archetypeId]: playerTexture,
        [PISTOL.id]: projectileTexture
      }),
      getSnapshotPair: () => pair,
      getPredictedSnapshotPair: () => predictedPair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();
    expect(findMeshWithMaterialMap(backend.lastScene(), playerTexture)?.position.x).toBeCloseTo(0);
    expect(projectileXPositions(backend.lastScene(), projectileTexture)).toEqual([0, 20]);

    predictedPair = { ...predictedPair, nowMs: receivedAtMs + SIM_STEP_MS / 2 };
    renderer.render();
    expect(findMeshWithMaterialMap(backend.lastScene(), playerTexture)?.position.x).toBeCloseTo(3);
    expect(projectileXPositions(backend.lastScene(), projectileTexture)[0]).toBeCloseTo(5);
    expect(projectileXPositions(backend.lastScene(), projectileTexture)[1]).toBeCloseTo(20);

    predictedPair = { ...predictedPair, nowMs: receivedAtMs + SIM_STEP_MS };
    renderer.render();
    expect(findMeshWithMaterialMap(backend.lastScene(), playerTexture)?.position.x).toBeCloseTo(6);
    expect(projectileXPositions(backend.lastScene(), projectileTexture)[0]).toBeCloseTo(10);
    expect(projectileXPositions(backend.lastScene(), projectileTexture)[1]).toBeCloseTo(20);
  });

  it('snaps online predicted self on same-form playerSpawn when predicted prev is reset', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const playerTexture = new THREE.Texture();
    const receivedAtMs = 500;
    const pair = createSnapshotPairWithEntities([
      playerSnapshot({
        id: 1,
        playerId: 'self',
        x: 10,
        y: 0,
        formArchetypeId: DEFAULT_PLAYER_VISUAL.archetypeId
      })
    ]);
    const predictedCurr = createSnapshot(
      [
        playerSnapshot({
          id: 101,
          playerId: 'self',
          x: 10,
          y: 0,
          state: 'alive',
          formArchetypeId: DEFAULT_PLAYER_VISUAL.archetypeId
        })
      ],
      { simTimeMs: 100 + SIM_STEP_MS }
    );
    const predictedPair: SnapshotPair = {
      prev: null,
      curr: predictedCurr,
      currReceivedAtMs: receivedAtMs,
      nowMs: receivedAtMs + SIM_STEP_MS / 2
    };
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({ [DEFAULT_PLAYER_VISUAL.archetypeId]: playerTexture }),
      getSnapshotPair: () => pair,
      getPredictedSnapshotPair: () => predictedPair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    expect(findMeshWithMaterialMap(backend.lastScene(), playerTexture)?.position.x).toBeCloseTo(10);
  });

  it('uses sequence-group own-projectile fallback for online prediction', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const projectileTexture = new THREE.Texture();
    let predicted: SnapshotPair['curr'] = null;
    const pair = createSnapshotPairWithEntities([
      playerSnapshot({ id: 1, playerId: 'self', x: 0, y: 0 }),
      projectileSnapshot({ id: 31, ownerId: 1, x: 1, spawnInputSequence: 42 }),
      projectileSnapshot({ id: 32, ownerId: 1, x: 2, spawnInputSequence: 42 }),
      projectileSnapshot({ id: 33, ownerId: 1, x: 3, spawnInputSequence: 42 })
    ]);
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({ [PISTOL.id]: projectileTexture }),
      getSnapshotPair: () => pair,
      getPredictedSnapshotPair: () => createSnapshotPair(predicted),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();
    expect(projectileXPositions(backend.lastScene(), projectileTexture)).toEqual([1, 2, 3]);

    predicted = createSnapshot([
      playerSnapshot({ id: 101, playerId: 'self', x: 0, y: 0 }),
      projectileSnapshot({ id: 201, ownerId: 101, x: 10, spawnInputSequence: 42 }),
      projectileSnapshot({ id: 202, ownerId: 101, x: 11, spawnInputSequence: 42 }),
      projectileSnapshot({ id: 203, ownerId: 101, x: 12, spawnInputSequence: 42 }),
      projectileSnapshot({ id: 204, ownerId: 101, x: 13, spawnInputSequence: 42 }),
      projectileSnapshot({ id: 205, ownerId: 101, x: 14, spawnInputSequence: 42 })
    ]);
    renderer.render();
    expect(projectileXPositions(backend.lastScene(), projectileTexture)).toEqual([
      10,
      11,
      12,
      13,
      14
    ]);
  });

  it('keeps online predicted projectile render ids stable when held-fire projectiles despawn', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const projectileTexture = new THREE.Texture();
    const pair = createSnapshotPairWithEntities([
      playerSnapshot({ id: 1, playerId: 'self', x: 0, y: 0 })
    ]);
    let predicted = createSnapshot([
      playerSnapshot({ id: 101, playerId: 'self', x: 0, y: 0 }),
      projectileSnapshot({ id: 201, ownerId: 101, x: 10, spawnInputSequence: 42 }),
      projectileSnapshot({ id: 202, ownerId: 101, x: 11, spawnInputSequence: 42 })
    ]);
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({ [PISTOL.id]: projectileTexture }),
      getSnapshotPair: () => pair,
      getPredictedSnapshotPair: () => createSnapshotPair(predicted),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();
    const retainedProjectile = findMeshesWithMaterialMap(
      backend.lastScene(),
      projectileTexture
    ).find((projectile) => projectile.position.x === 11);

    predicted = createSnapshot([
      playerSnapshot({ id: 101, playerId: 'self', x: 0, y: 0 }),
      projectileSnapshot({ id: 202, ownerId: 101, x: 12, spawnInputSequence: 42 })
    ]);
    renderer.render();

    const remainingProjectile = findMeshesWithMaterialMap(backend.lastScene(), projectileTexture)[0];
    expect(remainingProjectile).toBe(retainedProjectile);
    expect(remainingProjectile?.position.x).toBeCloseTo(12);
  });

  it('keeps online authoritative own projectiles with null spawn sequence visible', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const projectileTexture = new THREE.Texture();
    const pair = createSnapshotPairWithEntities([
      playerSnapshot({ id: 1, playerId: 'self', x: 0, y: 0 }),
      projectileSnapshot({ id: 31, ownerId: 1, x: 1, spawnInputSequence: null })
    ]);
    const predicted = createSnapshot([
      playerSnapshot({ id: 101, playerId: 'self', x: 0, y: 0 }),
      projectileSnapshot({ id: 201, ownerId: 101, x: 10, spawnInputSequence: 42 })
    ]);
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({ [PISTOL.id]: projectileTexture }),
      getSnapshotPair: () => pair,
      getPredictedSnapshotPair: () => createSnapshotPair(predicted),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();
    expect(projectileXPositions(backend.lastScene(), projectileTexture)).toEqual([1, 10]);
  });

  it('snaps online self transition presentation from the predicted snapshot', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const playerTexture = new THREE.Texture();
    const pair = createSnapshotPairWithEntities([
      playerSnapshot({ id: 1, playerId: 'self', x: 0, y: 0, state: 'alive' })
    ]);
    const predicted = createSnapshot([
      playerSnapshot({
        id: 101,
        playerId: 'self',
        x: 8,
        y: 0,
        statusEffects: [{ kind: 'burn', expireAtSimMs: 1000 }]
      })
    ]);
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({
        [DEFAULT_PLAYER_VISUAL.archetypeId]: playerTexture
      }),
      getSnapshotPair: () => pair,
      getPredictedSnapshotPair: () => createSnapshotPair(predicted),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const playerMesh = findMeshWithMaterialMap(backend.lastScene(), playerTexture);
    const statusMarker = findChildMeshByName(playerMesh, 'status-effect-marker');
    expect(playerMesh?.position.x).toBeCloseTo(8);
    expect(statusMarker?.visible).toBe(true);
  });

  it('renders player HP above the player sprite in companion bar style', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const playerTexture = new THREE.Texture();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({
        [DEFAULT_PLAYER_VISUAL.archetypeId]: playerTexture
      }),
      getSnapshotPair: () =>
        createSnapshotPairWithEntities([
          { id: 1, kind: 'player', x: 0, y: 0, hp: 3, maxHp: 5, statusEffects: [] }
        ]),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const playerMesh = findMeshWithMaterialMap(backend.lastScene(), playerTexture);
    const hpTrack = findChildMeshByName(playerMesh, 'player-hp-track');
    const hpFill = findChildMeshByName(playerMesh, 'player-hp-fill');
    const statusMarker = playerMesh?.children.find((child) => child.name === 'status-effect-marker');
    const fillMaterial = hpFill?.material;
    expect(hpTrack?.visible).toBe(true);
    expect(hpTrack?.parent?.position.y).toBeGreaterThan(DEFAULT_PLAYER_VISUAL.worldSize.height / 2);
    expect(hpFill?.visible).toBe(true);
    expect(hpFill?.scale.x).toBeCloseTo(0.6);
    expect(statusMarker?.visible).toBe(false);
    expect(fillMaterial).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect((fillMaterial as THREE.MeshBasicMaterial).color.getHex()).toBe(0x7ee7c8);
  });

  it('renders a selected companion at two player radii and keeps it still while close', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const petTexture = new THREE.Texture();
    const player = {
      ...TRAINING_PLAYER,
      radius: 2,
      maxSpeed: 4
    };
    let pair: SnapshotPair = {
      prev: null,
      curr: createSnapshot([{ id: 1, kind: 'player', x: 3, y: -1, hp: 5, maxHp: 5 }]),
      currReceivedAtMs: 0,
      nowMs: 1000 / (0.85 * 4)
    };
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession({
        players: [{ id: 'hero-training', ...player, loadout: null, companion: null }]
      }),
      spriteTextures: createSpriteTextures({ [PET_01.id]: petTexture }),
      selectedPetId: PET_01.id,
      getSnapshotPair: () => pair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const companionMesh = findMeshWithMaterialMap(backend.lastScene(), petTexture);
    expect(companionMesh).not.toBeNull();
    expect(companionMesh?.position.x).toBeCloseTo(7);
    expect(companionMesh?.position.y).toBeCloseTo(-1);
    expect(companionMesh?.scale.x).toBeCloseTo(1.07);
    expect(companionMesh?.scale.y).toBeCloseTo(0.9426);

    pair = {
      prev: null,
      curr: createSnapshot([{ id: 1, kind: 'player', x: 14, y: -1, hp: 5, maxHp: 5 }]),
      currReceivedAtMs: 0,
      nowMs: pair.nowMs + 1000
    };
    renderer.render();

    expect(companionMesh?.position.x).toBeCloseTo(7);
    expect(companionMesh?.position.y).toBeCloseTo(-1);
  });

  it('moves the selected companion toward the player only beyond four player radii', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const petTexture = new THREE.Texture();
    const player = {
      ...TRAINING_PLAYER,
      radius: 2,
      maxSpeed: 4
    };
    let pair: SnapshotPair = {
      prev: null,
      curr: createSnapshot([{ id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 }]),
      currReceivedAtMs: 0,
      nowMs: 0
    };
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession({
        players: [{ id: 'hero-training', ...player, loadout: null, companion: null }]
      }),
      spriteTextures: createSpriteTextures({ [PET_01.id]: petTexture }),
      selectedPetId: PET_01.id,
      getSnapshotPair: () => pair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();
    const companionMesh = findMeshWithMaterialMap(backend.lastScene(), petTexture);
    expect(companionMesh?.position.x).toBeCloseTo(4);

    pair = {
      prev: null,
      curr: createSnapshot([{ id: 1, kind: 'player', x: 11, y: 0, hp: 5, maxHp: 5 }]),
      currReceivedAtMs: 0,
      nowMs: 1000
    };
    renderer.render();
    expect(companionMesh?.position.x).toBeCloseTo(4);

    pair = {
      prev: null,
      curr: createSnapshot([{ id: 1, kind: 'player', x: 14, y: 0, hp: 5, maxHp: 5 }]),
      currReceivedAtMs: 0,
      nowMs: 2000
    };
    renderer.render();
    expect(companionMesh?.position.x).toBeCloseTo(6);
  });

  it('does not create a companion mesh when no pet is selected', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const petTexture = new THREE.Texture();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({ [PET_01.id]: petTexture }),
      selectedPetId: null,
      getSnapshotPair: () =>
        createSnapshotPairWithEntities([
          { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 }
        ]),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    expect(findMeshWithMaterialMap(backend.lastScene(), petTexture)).toBeNull();
  });

  it('renders runtime companion snapshots with an HP bar and warning marker', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const petTexture = new THREE.Texture();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({ [PET_01.id]: petTexture }),
      selectedPetId: null,
      getSnapshotPair: () =>
        createSnapshotPairWithEntities([
          { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
          companionSnapshot()
        ]),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const companionMesh = findMeshWithMaterialMap(backend.lastScene(), petTexture);
    expect(companionMesh).not.toBeNull();
    expect(companionMesh?.position.x).toBeCloseTo(2);
    expect(companionMesh?.position.y).toBeCloseTo(-1);
    const hpFill = findChildMeshByName(companionMesh, 'companion-hp-fill');
    const warningMarker = findChildMeshByName(companionMesh, 'companion-warning-marker');
    expect(hpFill?.visible).toBe(true);
    expect(hpFill?.scale.x).toBeCloseTo(0.5);
    expect(warningMarker?.visible).toBe(true);
  });

  it('renders ghost rescue state with aura, rescue ring and rapid flip', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const petTexture = new THREE.Texture();
    const pair: SnapshotPair = {
      prev: null,
      curr: createSnapshot([
        { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
        companionSnapshot({
          hp: 0,
          state: 'ghost',
          mode: 'rescue',
          rescueProgress: 0.5,
          targetId: null
        })
      ]),
      currReceivedAtMs: 0,
      nowMs: 90
    };
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession({
        players: [
          {
            id: 'hero-training',
            ...TRAINING_PLAYER,
            loadout: null,
            companion: {
              petArchetypeId: PET_01.id,
              maxHp: 6,
              contactBox: { width: 0.55, height: 0.55 },
              movement: { maxSpeed: 3, acceleration: 22, orbitRadius: 3.2 },
              threat: { acquireRadius: 5.5, releaseRadius: 6.5 },
              weaponLoadout: { weapons: ['pistol'], selectedIndex: 0 },
              boop: { radius: 1.1, impulse: 7, durationMs: 260, cooldownMs: 900 },
              rescue: { radius: 1.4, durationMs: 5000, reviveHpFraction: 0.5 }
            }
          }
        ]
      }),
      spriteTextures: createSpriteTextures({ [PET_01.id]: petTexture }),
      getSnapshotPair: () => pair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const companionMesh = findMeshWithMaterialMap(backend.lastScene(), petTexture);
    const rescueFill = findChildMeshByName(companionMesh, 'companion-hp-rescue-fill');
    const ghostAura = findChildMeshByName(companionMesh, 'companion-ghost-aura');
    const rescueRing = findChildMeshByName(companionMesh, 'companion-rescue-ring');
    const material = companionMesh?.material;
    expect(companionMesh?.scale.x).toBeLessThan(0);
    expect(rescueFill?.parent?.scale.x).toBeLessThan(0);
    expect(rescueFill?.visible).toBe(true);
    expect(rescueFill?.scale.x).toBeCloseTo(0.25);
    expect(ghostAura?.visible).toBe(true);
    expect(rescueRing?.visible).toBe(true);
    expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect((material as THREE.MeshBasicMaterial).opacity).toBeLessThan(1);
  });

  it('hides the renderer-only selected companion when a runtime companion exists', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const petTexture = new THREE.Texture();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({ [PET_01.id]: petTexture }),
      selectedPetId: PET_01.id,
      getSnapshotPair: () =>
        createSnapshotPairWithEntities([
          { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
          companionSnapshot({ x: -2, y: 1 })
        ]),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const petMeshes = findMeshesWithMaterialMap(backend.lastScene(), petTexture);
    const visiblePetMeshes = petMeshes.filter((mesh) => mesh.visible);
    expect(petMeshes).toHaveLength(2);
    expect(visiblePetMeshes).toHaveLength(1);
    expect(visiblePetMeshes[0]?.position.x).toBeCloseTo(-2);
    expect(visiblePetMeshes[0]?.position.y).toBeCloseTo(1);
  });

  it('throws for runtime companion snapshots with missing pet content or texture', () => {
    const canvas = createCanvasHarness();
    const missingPetBackend = createRendererBackendHarness();
    const missingPetRenderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({ 'missing-pet': new THREE.Texture() }),
      getSnapshotPair: () =>
        createSnapshotPairWithEntities([
          { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
          companionSnapshot({ petArchetypeId: 'missing-pet' })
        ]),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: missingPetBackend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    expect(() => missingPetRenderer.render()).toThrow('pet archetype missing');

    const missingTextureBackend = createRendererBackendHarness();
    const missingTextureRenderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () =>
        createSnapshotPairWithEntities([
          { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
          companionSnapshot()
        ]),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: missingTextureBackend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    expect(() => missingTextureRenderer.render()).toThrow('pet texture missing');
  });

  it('shows a reward marker on carrier enemies', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const enemyTexture = new THREE.Texture();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({ [SLIME_BUG.id]: enemyTexture }),
      getSnapshotPair: () =>
        createSnapshotPairWithEntities([
          { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
          {
            id: 2,
            kind: 'enemy',
            archetypeId: SLIME_BUG.id,
            x: 1,
            y: 1,
            hp: 2,
            maxHp: 2,
            carrierDropMarker: 'reward'
          }
        ]),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const enemyMesh = findMeshWithMaterialMap(backend.lastScene(), enemyTexture);
    const marker = enemyMesh?.children.find((child) => child.name === 'carrier-reward-marker');
    expect(marker).toBeInstanceOf(THREE.Mesh);
    expect(marker?.visible).toBe(true);
  });

  it('shows status markers on statused actors', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const enemyTexture = new THREE.Texture();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({ [SLIME_BUG.id]: enemyTexture }),
      getSnapshotPair: () =>
        createSnapshotPairWithEntities([
          { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
          {
            id: 2,
            kind: 'enemy',
            archetypeId: SLIME_BUG.id,
            x: 1,
            y: 1,
            hp: 2,
            maxHp: 2,
            statusEffects: [{ kind: 'burn', expiresAtSimMs: 1000 }]
          }
        ]),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const enemyMesh = findMeshWithMaterialMap(backend.lastScene(), enemyTexture);
    const marker = enemyMesh?.children.find((child) => child.name === 'status-effect-marker');
    expect(marker).toBeInstanceOf(THREE.Mesh);
    expect(marker?.visible).toBe(true);
  });

  it('applies projectile visual state and grounded explosion radius indicators', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const projectileTexture = new THREE.Texture();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({ [BOMB_PLACER.id]: projectileTexture }),
      getSnapshotPair: () =>
        createSnapshotPairWithEntities([
          { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
          {
            id: 20,
            kind: 'projectile',
            weaponArchetypeId: BOMB_PLACER.id,
            ownerKind: 'player',
            originX: 2,
            originY: 1,
            x: 2,
            y: 1,
            size: {
              width: BOMB_PLACER.projectile.size.width * 2,
              height: BOMB_PLACER.projectile.size.height * 3
            },
            state: 'grounded',
            visualState: {
              angleRadians: 0.25,
              spinRadians: 0.5,
              pulsePhase: 0.25
            },
            explosionRadius: BOMB_PLACER.projectile.explosion!.radius,
            detonateAtSimMs: 1000,
            arcEnd: null
          }
        ]),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const projectileMesh = findProjectileMesh(backend.lastScene());
    const radiusIndicator = projectileMesh?.children.find(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh
    );
    expect(projectileMesh).not.toBeNull();
    expect(projectileMesh?.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    expect(projectileMesh?.geometry).not.toBeInstanceOf(THREE.CircleGeometry);
    expect(projectileMesh?.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    if (projectileMesh?.material instanceof THREE.MeshBasicMaterial) {
      expect(projectileMesh.material.map).toBe(projectileTexture);
    }
    expect(projectileMesh?.rotation.z).toBeCloseTo(0.5);
    expect(projectileMesh?.scale.x).toBeCloseTo(2.2);
    expect(projectileMesh?.scale.y).toBeCloseTo(3.3);
    expect(radiusIndicator?.visible).toBe(true);
    expect(radiusIndicator?.scale.x).toBeCloseTo(BOMB_PLACER.projectile.explosion!.radius / 2);
    expect(radiusIndicator?.scale.y).toBeCloseTo(BOMB_PLACER.projectile.explosion!.radius / 3);
    const outline = radiusIndicator?.children.find(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.name === 'projectile-radius-outline'
    );
    expect(outline).toBeDefined();
    expect((outline?.material as THREE.MeshBasicMaterial | undefined)?.color.getHex()).toBe(
      AIM_RING_OUTLINE_COLOR
    );
    expect((outline?.material as THREE.MeshBasicMaterial | undefined)?.opacity).toBe(
      PROJECTILE_RADIUS_OUTLINE_OPACITY
    );
  });

  it('uses ProjectileSnapshot.size instead of weapon HUD modifiers for projectile scale', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => ({
        prev: null,
        curr: {
          ...createSnapshot([
            { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
            {
              id: 20,
              kind: 'projectile',
              weaponArchetypeId: PISTOL.id,
              ownerKind: 'player',
              originX: 0,
              originY: 0,
              x: 2,
              y: 0,
              size: PISTOL.projectile.size,
              state: 'flying',
              visualState: {
                angleRadians: 0,
                spinRadians: 0,
                pulsePhase: 0
              },
              explosionRadius: null,
              detonateAtSimMs: null,
              arcEnd: null
            }
          ]),
          weaponHud: {
            selectedIndex: 0,
            weapons: [
              {
                index: 0,
                weaponArchetypeId: PISTOL.id,
                cooldownStartedAtSimMs: 0,
                cooldownReadyAtSimMs: 0,
                modifiers: [{ kind: 'projectileSizeMultiplier', multiplier: 4 }],
                timedEffects: []
              }
            ]
          }
        },
        currReceivedAtMs: 0,
        nowMs: 0
      }),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const projectileMesh = findProjectileMesh(backend.lastScene());
    expect(projectileMesh?.scale.x).toBeCloseTo(1);
    expect(projectileMesh?.scale.y).toBeCloseTo(1);
  });

  it('hides newly fired projectiles until they travel the player radius from the fire origin', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    let pair = createSnapshotPairWithEntities([
      { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
      {
        id: 20,
        kind: 'projectile',
        weaponArchetypeId: PISTOL.id,
        ownerKind: 'player',
        originX: 0,
        originY: 0,
        x: 0.5,
        y: 0,
        size: PISTOL.projectile.size,
        state: 'flying',
        visualState: {
          angleRadians: 0,
          spinRadians: 0,
          pulsePhase: 0
        },
        explosionRadius: null,
        detonateAtSimMs: null,
        arcEnd: null
      }
    ]);
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => pair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const nearProjectile = findProjectileMesh(backend.lastScene());
    expect(nearProjectile).not.toBeNull();
    expect(nearProjectile?.visible).toBe(false);

    pair = createSnapshotPairWithEntities([
      { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
      {
        id: 20,
        kind: 'projectile',
        weaponArchetypeId: PISTOL.id,
        ownerKind: 'player',
        originX: 0,
        originY: 0,
        x: DEFAULT_PLAYER_VISUAL.worldSize.height / 2 + 0.05,
        y: 0,
        size: PISTOL.projectile.size,
        state: 'flying',
        visualState: {
          angleRadians: 0,
          spinRadians: 0,
          pulsePhase: 0
        },
        explosionRadius: null,
        detonateAtSimMs: null,
        arcEnd: null
      }
    ]);
    renderer.render();

    const farProjectile = findProjectileMesh(backend.lastScene());
    expect(farProjectile?.visible).toBe(true);
  });

  it('renders and clears enemy arc projectile landing telegraphs', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    let pair = createSnapshotPairWithEntities([
      { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
      {
        id: 20,
        kind: 'projectile',
        weaponArchetypeId: GRENADE_LAUNCHER.id,
        ownerKind: 'enemy',
        originX: 0,
        originY: 0,
        x: 1,
        y: 0,
        size: GRENADE_LAUNCHER.projectile.size,
        state: 'flying',
        visualState: {
          angleRadians: 0,
          spinRadians: 0,
          pulsePhase: 0
        },
        explosionRadius: GRENADE_LAUNCHER.projectile.explosion!.radius,
        detonateAtSimMs: null,
        arcEnd: { x: 3, y: -2 }
      }
    ]);
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => pair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const marker = findLandingTelegraphMesh(backend.lastScene());
    expect(marker).not.toBeNull();
    expect(marker?.position.x).toBeCloseTo(3);
    expect(marker?.position.y).toBeCloseTo(-2);
    expect(marker?.scale.x).toBeCloseTo(GRENADE_LAUNCHER.projectile.explosion!.radius * 2);

    pair = createSnapshotPairWithEntities([
      { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
      {
        id: 20,
        kind: 'projectile',
        weaponArchetypeId: GRENADE_LAUNCHER.id,
        ownerKind: 'enemy',
        originX: 0,
        originY: 0,
        x: 3,
        y: -2,
        size: GRENADE_LAUNCHER.projectile.size,
        state: 'grounded',
        visualState: {
          angleRadians: 0,
          spinRadians: 0,
          pulsePhase: 0
        },
        explosionRadius: GRENADE_LAUNCHER.projectile.explosion!.radius,
        detonateAtSimMs: 1000,
        arcEnd: null
      }
    ]);
    renderer.render();

    expect(findLandingTelegraphMesh(backend.lastScene())).toBeNull();
  });

  it('renders drops as sprite-backed plane meshes', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const dropTexture = new THREE.Texture();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({ [HEAL_ORB.id]: dropTexture }),
      getSnapshotPair: () =>
        createSnapshotPairWithEntities([
          { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
          { id: 30, kind: 'drop', archetypeId: HEAL_ORB.id, x: 2, y: 1 }
        ]),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const dropMesh = findMeshWithMaterialMap(backend.lastScene(), dropTexture);
    expect(dropMesh).not.toBeNull();
    expect(dropMesh?.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    expect(dropMesh?.geometry).not.toBeInstanceOf(THREE.CircleGeometry);
  });

  it('renders field effects as translucent radius circles', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () =>
        createSnapshotPairWithEntities([
          { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
          {
            id: 44,
            kind: 'fieldEffect',
            archetypeId: 'demo-burning-puddle',
            x: 2,
            y: -1,
            radius: 1.6,
            expiresAtSimMs: 1000
          }
        ]),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const fieldMesh = backend
      .lastScene()
      ?.children.find(
        (child): child is THREE.Mesh =>
          child instanceof THREE.Mesh && child.geometry instanceof THREE.CircleGeometry
      );
    expect(fieldMesh).toBeDefined();
    expect(fieldMesh?.position.x).toBeCloseTo(2);
    expect(fieldMesh?.position.y).toBeCloseTo(-1);
    expect(fieldMesh?.scale.x).toBeCloseTo(1.6);
  });

  it('renders main-owned portal descriptors as world-space black oval portals', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const portals: ReadonlyArray<VibeJamPortalDescriptor> = [
      { kind: 'return', x: 2, y: -1, width: 1.2, height: 1.6 }
    ];
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => ({ ...createEmptySnapshotPair(), nowMs: 120 }),
      getPortalDescriptors: () => portals,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const portal = findPortalGroup(backend.lastScene());
    const interior = findPortalPart(portal, PORTAL_INTERIOR_NAME);
    const outline = findPortalPart(portal, PORTAL_OUTLINE_NAME);
    const label = findPortalPart(portal, PORTAL_RETURN_LABEL_NAME);

    expect(portal).not.toBeNull();
    expect(portal?.position.x).toBeCloseTo(2);
    expect(portal?.position.y).toBeCloseTo(-1);
    expect(portal?.scale.x).toBeCloseTo(1.2);
    expect(portal?.scale.y).toBeCloseTo(1.6);
    expect(interior?.geometry).toBeInstanceOf(THREE.CircleGeometry);
    expect(outline?.geometry).toBeInstanceOf(THREE.RingGeometry);
    expect((interior?.material as THREE.MeshBasicMaterial | undefined)?.color.getHex()).toBe(
      PORTAL_INTERIOR_COLOR
    );
    expect((outline?.material as THREE.MeshBasicMaterial | undefined)?.color.getHex()).not.toBe(
      PORTAL_INTERIOR_COLOR
    );
    expect(label?.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    expect(label?.visible).toBe(true);
    expect(label?.position.y).toBeLessThan(0);
    expect(label?.scale.x).toBeCloseTo(1 / 1.2);
    expect(label?.scale.y).toBeCloseTo(1 / 1.6);
  });

  it('animates portal outline shimmer unless reduced motion is requested', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    let nowMs = 0;
    const portals: ReadonlyArray<VibeJamPortalDescriptor> = [
      { kind: 'return', x: 0, y: 0, width: 1, height: 1 }
    ];
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => ({ ...createEmptySnapshotPair(), nowMs }),
      getPortalDescriptors: () => portals,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();
    const outline = findPortalPart(findPortalGroup(backend.lastScene()), PORTAL_OUTLINE_NAME);
    const firstColor = (outline?.material as THREE.MeshBasicMaterial | undefined)?.color.getHex();
    nowMs = 500;
    renderer.render();
    const secondColor = (outline?.material as THREE.MeshBasicMaterial | undefined)?.color.getHex();

    expect(firstColor).not.toBe(secondColor);

    const reducedBackend = createRendererBackendHarness();
    nowMs = 0;
    const reducedRenderer = createRenderer({
      canvas: createCanvasHarness(),
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => ({ ...createEmptySnapshotPair(), nowMs }),
      getPortalDescriptors: () => portals,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2,
        matchMedia: () => ({ matches: true }) as MediaQueryList
      },
      createRendererBackend: reducedBackend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    reducedRenderer.render();
    const reducedOutline = findPortalPart(
      findPortalGroup(reducedBackend.lastScene()),
      PORTAL_OUTLINE_NAME
    );
    const reducedFirstColor = (
      reducedOutline?.material as THREE.MeshBasicMaterial | undefined
    )?.color.getHex();
    nowMs = 1000;
    reducedRenderer.render();
    const reducedSecondColor = (
      reducedOutline?.material as THREE.MeshBasicMaterial | undefined
    )?.color.getHex();

    expect(reducedFirstColor).toBe(reducedSecondColor);
  });

  it('uses a distinct cyan-pink shimmer for exit portals', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const portals: ReadonlyArray<VibeJamPortalDescriptor> = [
      { kind: 'return', x: -8, y: 0, width: 1, height: 1 },
      { kind: 'exit', x: 8, y: 0, width: 1, height: 1 }
    ];
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => ({ ...createEmptySnapshotPair(), nowMs: 120 }),
      getPortalDescriptors: () => portals,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const groups = findPortalGroups(backend.lastScene());
    const returnPortal = groups.find((group) => group.position.x === -8) ?? null;
    const exitPortal = groups.find((group) => group.position.x === 8) ?? null;
    const returnOutline = findPortalPart(returnPortal, PORTAL_OUTLINE_NAME);
    const exitOutline = findPortalPart(exitPortal, PORTAL_OUTLINE_NAME);
    const returnLabel = findPortalPart(returnPortal, PORTAL_RETURN_LABEL_NAME);
    const exitLabel = findPortalPart(exitPortal, PORTAL_RETURN_LABEL_NAME);

    expect(groups).toHaveLength(2);
    expect((returnOutline?.material as THREE.MeshBasicMaterial | undefined)?.color.getHex()).not.toBe(
      (exitOutline?.material as THREE.MeshBasicMaterial | undefined)?.color.getHex()
    );
    expect(returnLabel?.visible).toBe(true);
    expect(exitLabel?.visible).toBe(false);
  });

  it('removes portal meshes when main stops providing descriptors', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    let portals: ReadonlyArray<VibeJamPortalDescriptor> = [
      { kind: 'return', x: 0, y: 0, width: 1, height: 1 }
    ];
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: createEmptySnapshotPair,
      getPortalDescriptors: () => portals,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();
    expect(findPortalGroup(backend.lastScene())).not.toBeNull();

    portals = [];
    renderer.render();

    expect(findPortalGroup(backend.lastScene())).toBeNull();
  });

  it('keeps the portal visible while portal travel zooms the player sprite out', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const playerTexture = new THREE.Texture();
    const portals: ReadonlyArray<VibeJamPortalDescriptor> = [
      {
        kind: 'exit',
        x: 2,
        y: 0,
        width: 1,
        height: 1,
        travelStartedAtSimMs: 0,
        travelDurationMs: 1000
      }
    ];
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({ [DEFAULT_PLAYER_VISUAL.archetypeId]: playerTexture }),
      getSnapshotPair: () => ({
        prev: null,
        curr: createSnapshot([{ id: 1, kind: 'player', x: 2, y: 0, hp: 5, maxHp: 5 }], {
          simTimeMs: 500
        }),
        currReceivedAtMs: 0,
        nowMs: 500
      }),
      getPortalDescriptors: () => portals,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const playerMesh = findMeshWithMaterialMap(backend.lastScene(), playerTexture);

    expect(findPortalGroup(backend.lastScene())).not.toBeNull();
    expect(playerMesh?.scale.x).toBeLessThan(1);
    expect(playerMesh?.scale.y).toBeLessThan(1);
    expect(playerMesh?.scale.x).toBeGreaterThan(0.08);
  });

  it('animates picked-up drops toward the current picker position while shrinking', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const dropTexture = new THREE.Texture();
    let pair = createSnapshotPairWithEntities([
      { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 }
    ]);
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({ [HEAL_ORB.id]: dropTexture }),
      getSnapshotPair: () => pair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();
    renderer.handleEvent({
      kind: 'dropPickup',
      simTime: 0,
      entityId: 50,
      archetypeId: HEAL_ORB.id,
      pickerId: 1,
      x: 2,
      y: 0
    });
    pair = {
      ...pair,
      curr: createSnapshot([{ id: 1, kind: 'player', x: 1, y: 0, hp: 5, maxHp: 5 }]),
      nowMs: 140
    };
    renderer.render();

    const ghost = findMeshWithMaterialMap(backend.lastScene(), dropTexture);
    expect(ghost).not.toBeNull();
    expect(ghost?.position.x).toBeLessThan(2);
    expect(ghost?.position.x).toBeGreaterThan(1);
    expect(ghost?.scale.x).toBeLessThan(1);
  });

  it('shows an arc landing preview for the selected arc weapon', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => ({
        prev: null,
        curr: createSnapshot([{ id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 }], {
          weaponHud: {
            selectedIndex: 0,
            weapons: [
              {
                index: 0,
                weaponArchetypeId: ROCK_THROWER.id,
                cooldownStartedAtSimMs: 0,
                cooldownReadyAtSimMs: 0,
                modifiers: [],
                timedEffects: []
              }
            ]
          }
        }),
        currReceivedAtMs: 0,
        nowMs: 0
      }),
      getAim: () => ({ x: 10, y: 0 }),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const preview = findArcPreviewMesh(backend.lastScene());
    const crosshair = findCrosshairGroup(backend.lastScene());
    if (ROCK_THROWER.projectile.motion.kind !== 'arc') throw new Error('expected arc weapon');
    expect(preview?.visible).toBe(true);
    const outline = preview?.children.find(
      (child): child is THREE.Mesh =>
        child instanceof THREE.Mesh && child.name === ARC_PREVIEW_OUTLINE_NAME
    );
    expect(outline).toBeDefined();
    expect((outline?.material as THREE.MeshBasicMaterial | undefined)?.color.getHex()).toBe(
      AIM_RING_OUTLINE_COLOR
    );
    expect(preview?.position.x).toBeCloseTo(ROCK_THROWER.projectile.motion.range);
    expect(preview?.position.y).toBeCloseTo(0);
    expect(crosshair?.visible).toBe(true);
    expect(crosshair?.children).toHaveLength(3);
    expect(crosshair?.renderOrder).toBe(CROSSHAIR_RENDER_ORDER);
    const crosshairOutline = crosshair?.children.find(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.name === 'crosshair-outline'
    );
    expect(crosshairOutline).toBeDefined();
    expect(crosshairOutline?.renderOrder).toBe(CROSSHAIR_OUTLINE_RENDER_ORDER);
    expect(crosshairOutline?.geometry).toBeInstanceOf(THREE.ShapeGeometry);
    expect((crosshairOutline?.material as THREE.MeshBasicMaterial | undefined)?.opacity).toBe(
      CROSSHAIR_OUTLINE_OPACITY
    );
    for (const mesh of crosshair?.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh) ?? []) {
      expect((mesh.material as THREE.MeshBasicMaterial).depthTest).toBe(false);
    }
    const crosshairMarks = crosshair?.children.filter((child): child is THREE.Mesh => {
      return child instanceof THREE.Mesh && child.name !== 'crosshair-outline';
    }) ?? [];
    expect(crosshairMarks).toHaveLength(2);
    for (const mark of crosshairMarks) {
      expect(mark.renderOrder).toBe(CROSSHAIR_RENDER_ORDER);
      expect((mark.material as THREE.MeshBasicMaterial).opacity).toBe(CROSSHAIR_OPACITY);
      expect((mark.material as THREE.MeshBasicMaterial).transparent).toBe(true);
    }
  });

  it('adds render-only squash and stretch to slime sprites while the player breathes', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const playerTexture = new THREE.Texture();
    const enemyTexture = new THREE.Texture();
    const pair: SnapshotPair = {
      prev: null,
      curr: createSnapshot([
        { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
        {
          id: 0,
          kind: 'enemy',
          archetypeId: SLIME_BUG.id,
          x: 1,
          y: 1,
          hp: 2,
          maxHp: 2
        }
      ]),
      currReceivedAtMs: 0,
      nowMs: 1000 / (0.85 * 4)
    };
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({
        [DEFAULT_PLAYER_VISUAL.archetypeId]: playerTexture,
        [SLIME_BUG.id]: enemyTexture
      }),
      getSnapshotPair: () => pair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const scene = backend.lastScene();
    const playerMesh = findMeshWithMaterialMap(scene, playerTexture);
    const enemyMesh = findMeshWithMaterialMap(scene, enemyTexture);

    expect(playerMesh?.scale.x).toBeGreaterThan(1);
    expect(playerMesh?.scale.y).toBeLessThan(1);
    expect(enemyMesh?.scale.x).toBeCloseTo(1.07);
    expect(enemyMesh?.scale.y).toBeCloseTo(0.9426);
  });

  it('layers hit flash and squash on enemy sprites without affecting the player sprite', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const playerTexture = new THREE.Texture();
    const enemyTexture = new THREE.Texture();
    let pair: SnapshotPair = {
      prev: null,
      curr: createSnapshot([
        { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
        {
          id: 2,
          kind: 'enemy',
          archetypeId: SLIME_BUG.id,
          x: 1,
          y: 1,
          hp: 2,
          maxHp: 2
        }
      ]),
      currReceivedAtMs: 0,
      nowMs: 0
    };
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({
        [DEFAULT_PLAYER_VISUAL.archetypeId]: playerTexture,
        [SLIME_BUG.id]: enemyTexture
      }),
      getSnapshotPair: () => pair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.handleEvent({
      kind: 'hit',
      simTime: 0,
      projectileId: 10,
      ownerId: 1,
      ownerKind: 'player',
      targetId: 2,
      targetKind: 'enemy',
      targetArchetypeId: SLIME_BUG.id,
      weaponArchetypeId: 'pistol',
      damage: 1,
      impactDirX: 1,
      impactDirY: 0,
      x: 1,
      y: 1
    });
    renderer.render();

    const scene = backend.lastScene();
    const playerMesh = findMeshWithMaterialMap(scene, playerTexture);
    const enemyMesh = findMeshWithMaterialMap(scene, enemyTexture);
    const enemyMaterial = enemyMesh?.material;
    expect(playerMesh?.scale.x).toBe(1);
    expect(enemyMesh?.scale.x).toBeGreaterThan(1.1);
    expect(enemyMaterial).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect((enemyMaterial as THREE.MeshBasicMaterial).color.r).toBeGreaterThan(1);

    pair = { ...pair, nowMs: 500 };
    renderer.render();
    expect(enemyMesh?.scale.x).toBeLessThan(1.1);
    expect((enemyMaterial as THREE.MeshBasicMaterial).color.r).toBe(1);
  });

  it('snaps character positions to the low backing-pixel grid', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const playerTexture = new THREE.Texture();
    const enemyTexture = new THREE.Texture();
    const bossTexture = new THREE.Texture();
    const pair: SnapshotPair = {
      prev: createSnapshot([
        { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
        {
          id: 2,
          kind: 'enemy',
          archetypeId: SLIME_BUG.id,
          x: 0,
          y: 0,
          hp: 2,
          maxHp: 2
        },
        {
          id: 3,
          kind: 'boss',
          archetypeId: BOSS_GARGOYLE.id,
          x: 0,
          y: 0,
          hp: 10,
          maxHp: 10,
          phaseIndex: 0,
          phaseId: 'phase-0',
          activeAttackIds: []
        }
      ]),
      curr: createSnapshot([
        { id: 1, kind: 'player', x: 0.11, y: -0.11, hp: 5, maxHp: 5 },
        {
          id: 2,
          kind: 'enemy',
          archetypeId: SLIME_BUG.id,
          x: 1.23,
          y: -1.23,
          hp: 2,
          maxHp: 2
        },
        {
          id: 3,
          kind: 'boss',
          archetypeId: BOSS_GARGOYLE.id,
          x: -2.37,
          y: 2.37,
          hp: 10,
          maxHp: 10,
          phaseIndex: 0,
          phaseId: 'phase-0',
          activeAttackIds: []
        }
      ]),
      currReceivedAtMs: 0,
      nowMs: 0
    };
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'low',
      arena: { width: 16, height: 8 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures({
        [DEFAULT_PLAYER_VISUAL.archetypeId]: playerTexture,
        [SLIME_BUG.id]: enemyTexture,
        [BOSS_GARGOYLE.id]: bossTexture
      }),
      getSnapshotPair: () => pair,
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();

    const scene = backend.lastScene();
    const playerMesh = findMeshWithMaterialMap(scene, playerTexture);
    const enemyMesh = findMeshWithMaterialMap(scene, enemyTexture);
    const bossMesh = findMeshWithMaterialMap(scene, bossTexture);
    const stepX = ((16 / 9) * 8) / 200;
    const stepY = 8 / 113;
    const snap = (value: number, step: number): number => Math.round(value / step) * step;

    expect(playerMesh?.position.x).toBeCloseTo(snap(0.11, stepX));
    expect(playerMesh?.position.y).toBeCloseTo(snap(-0.11, stepY));
    expect(enemyMesh?.position.x).toBeCloseTo(snap(1.23, stepX));
    expect(enemyMesh?.position.y).toBeCloseTo(snap(-1.23, stepY));
    expect(bossMesh?.position.x).toBeCloseTo(snap(-2.37, stepX));
    expect(bossMesh?.position.y).toBeCloseTo(snap(2.37, stepY));
  });

  it('switches and tiles the arena background from the active encounter configuration', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const bg1 = new THREE.Texture();
    const bg2 = new THREE.Texture();
    setTextureImageSize(bg1, 800, 800);
    setTextureImageSize(bg2, 1200, 600);
    let pair: SnapshotPair = {
      prev: null,
      curr: {
        simTimeMs: 0,
        entities: [],
        encounter: {
          id: 'wave-1',
          type: 'wave',
          index: 0,
          elapsedMs: 0,
          waveOrdinal: 1
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null,
        lastInputSequence: {}
      },
      currReceivedAtMs: 0,
      nowMs: 0
    };
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession({
        backgrounds: [
          { id: 'set-1', imageUrl: '/images/bg/bg-01.jpg' },
          { id: 'set-2', imageUrl: '/images/bg/bg-02.jpg' }
        ],
        encounters: [
          createEncounter('wave-1', 'set-1'),
          createEncounter('boss-1', 'set-2')
        ]
      }),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () => pair,
      loadBackgroundTexture: (url) => (url.endsWith('bg-01.jpg') ? bg1 : bg2),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    renderer.render();
    const firstBackgroundMesh = findMeshWithMaterialMap(backend.lastScene(), bg1);
    expect(firstBackgroundMesh).not.toBeNull();
    expect(firstBackgroundMesh?.scale.x).toBe(16);
    expect(firstBackgroundMesh?.scale.y).toBe(9);
    expect(bg1.wrapS).toBe(THREE.RepeatWrapping);
    expect(bg1.wrapT).toBe(THREE.RepeatWrapping);
    expect(bg1.repeat.x).toBeCloseTo(16 / (800 / PX_PER_WU));
    expect(bg1.repeat.y).toBeCloseTo(9 / (800 / PX_PER_WU));

    pair = {
      ...pair,
      curr: {
        ...pair.curr!,
        encounter: {
          id: 'boss-1',
          type: 'boss',
          index: 1,
          elapsedMs: 0,
          waveOrdinal: null
        }
      }
    };
    renderer.render();

    const secondBackgroundMesh = findMeshWithMaterialMap(backend.lastScene(), bg2);
    expect(secondBackgroundMesh).not.toBeNull();
    expect(secondBackgroundMesh?.scale.x).toBe(16);
    expect(secondBackgroundMesh?.scale.y).toBe(9);
    expect(bg2.wrapS).toBe(THREE.RepeatWrapping);
    expect(bg2.wrapT).toBe(THREE.RepeatWrapping);
    expect(bg2.repeat.x).toBeCloseTo(16 / (1200 / PX_PER_WU));
    expect(bg2.repeat.y).toBeCloseTo(9 / (600 / PX_PER_WU));
  });

  it('throws when the required hero texture is missing before the first frame', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();

    expect(() =>
      createRenderer({
        canvas,
        renderScalePreset: 'medium',
        arena: { width: 16, height: 9 },
        session: createRenderSession(),
        spriteTextures: {},
        getSnapshotPair: createEmptySnapshotPair,
        windowTarget: {
          innerWidth: 800,
          innerHeight: 600,
          devicePixelRatio: 2
        },
        createRendererBackend: backend.factory,
        createDebugHud: () => ({
          update(): void {},
          dispose(): void {}
        })
      })
    ).toThrow(`player texture missing for archetype "${DEFAULT_PLAYER_VISUAL.archetypeId}"`);
  });

  it('throws when the selected companion id is missing pet content', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();

    expect(() =>
      createRenderer({
        canvas,
        renderScalePreset: 'medium',
        arena: { width: 16, height: 9 },
        session: createRenderSession(),
        spriteTextures: createSpriteTextures({ 'pet-missing': new THREE.Texture() }),
        selectedPetId: 'pet-missing',
        getSnapshotPair: createEmptySnapshotPair,
        windowTarget: {
          innerWidth: 800,
          innerHeight: 600,
          devicePixelRatio: 2
        },
        createRendererBackend: backend.factory,
        createDebugHud: () => ({
          update(): void {},
          dispose(): void {}
        })
      })
    ).toThrow('pet archetype missing for id "pet-missing"');
  });

  it('throws when the selected companion texture was not preloaded', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();

    expect(() =>
      createRenderer({
        canvas,
        renderScalePreset: 'medium',
        arena: { width: 16, height: 9 },
        session: createRenderSession(),
        spriteTextures: createSpriteTextures(),
        selectedPetId: PET_01.id,
        getSnapshotPair: createEmptySnapshotPair,
        windowTarget: {
          innerWidth: 800,
          innerHeight: 600,
          devicePixelRatio: 2
        },
        createRendererBackend: backend.factory,
        createDebugHud: () => ({
          update(): void {},
          dispose(): void {}
        })
      })
    ).toThrow(`pet texture missing for archetype "${PET_01.id}"`);
  });

  it('throws when an entity snapshot references an unknown visual spec', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () =>
        createSnapshotPairWithEntities([
          { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
          {
            id: 2,
            kind: 'enemy',
            archetypeId: 'missing-enemy-visual',
            x: 1,
            y: 1,
            hp: 2,
            maxHp: 2
          }
        ]),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    expect(() => renderer.render()).toThrow(
      'enemy visual missing for archetype "missing-enemy-visual"'
    );
  });

  it('throws when an entity snapshot references a missing preloaded texture', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
      session: createRenderSession(),
      spriteTextures: createSpriteTextures(),
      getSnapshotPair: () =>
        createSnapshotPairWithEntities([
          { id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 },
          {
            id: 2,
            kind: 'enemy',
            archetypeId: SLIME_BUG.id,
            x: 1,
            y: 1,
            hp: 2,
            maxHp: 2
          }
        ]),
      windowTarget: {
        innerWidth: 800,
        innerHeight: 600,
        devicePixelRatio: 2
      },
      createRendererBackend: backend.factory,
      createDebugHud: () => ({
        update(): void {},
        dispose(): void {}
      })
    });

    expect(() => renderer.render()).toThrow(
      `enemy texture missing for archetype "${SLIME_BUG.id}"`
    );
  });
});
