import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { SnapshotPair } from '../sim/SimWorkerHost';

import { BOSS_GARGOYLE } from '../../shared/content/bosses';
import { HEAL_ORB } from '../../shared/content/drops';
import { SLIME_BUG } from '../../shared/content/enemies';
import { BOMB_PLACER, GRENADE_LAUNCHER, PISTOL, ROCK_THROWER } from '../../shared/content/weapons';
import type { SessionDefinition } from '../../shared/session';
import { PX_PER_WU } from '../../shared/sprite/spriteScale';
import { DROP_VISUALS } from './dropVisuals';
import { LANDING_TELEGRAPH_NAME } from './landingTelegraph';
import { DEFAULT_PLAYER_VISUAL } from './playerVisuals';
import { PROJECTILE_VISUALS } from './projectileVisuals';
import { createRenderer } from './Renderer';
import type { TextureMap } from './spritePreload';

const AIM_RING_OUTLINE_COLOR = 0xd97706;
const PROJECTILE_RADIUS_OUTLINE_OPACITY = 0.54;
const CROSSHAIR_OPACITY = 0.78;
const CROSSHAIR_OUTLINE_OPACITY = 1;
const CROSSHAIR_OUTLINE_RENDER_ORDER = 20;
const CROSSHAIR_RENDER_ORDER = 21;

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

  return {
    factory() {
      return {
        setPixelRatio(value: number): void {
          ops.push({ kind: 'pixelRatio', value });
        },
        setSize(width: number, height: number, updateStyle = true): void {
          ops.push({ kind: 'size', width, height, updateStyle });
        },
        render(scene: THREE.Scene): void {
          lastScene = scene;
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

type SnapshotEntities = NonNullable<SnapshotPair['curr']>['entities'];

function createSnapshot(entities: SnapshotEntities): NonNullable<SnapshotPair['curr']> {
  return {
    simTimeMs: 0,
    entities,
    encounter: null,
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null,
    weaponHud: null
  };
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
  overrides: Partial<Pick<SessionDefinition, 'backgrounds' | 'encounters'>> = {}
): Pick<SessionDefinition, 'backgrounds' | 'encounters'> {
  return {
    backgrounds: [],
    encounters: [],
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

function findMeshWithMaterialMap(scene: THREE.Scene | null, texture: THREE.Texture): THREE.Mesh | null {
  if (scene === null) return null;
  return scene.children.find((child): child is THREE.Mesh => {
    if (!(child instanceof THREE.Mesh)) return false;
    const material = child.material;
    if (Array.isArray(material)) return false;
    return material instanceof THREE.MeshBasicMaterial && material.map === texture;
  }) ?? null;
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

function setTextureImageSize(texture: THREE.Texture, width: number, height: number): void {
  Object.defineProperty(texture, 'image', {
    value: { width, height },
    configurable: true
  });
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
    expect(projectileMesh?.scale.x).toBeCloseTo(1.1);
    expect(radiusIndicator?.visible).toBe(true);
    expect(radiusIndicator?.scale.x).toBeCloseTo(BOMB_PLACER.projectile.explosion!.radius);
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
        curr: {
          ...createSnapshot([{ id: 1, kind: 'player', x: 0, y: 0, hp: 5, maxHp: 5 }]),
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
        },
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
      (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.name === 'arc-preview-outline'
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

  it('adds render-only squash and stretch to slime sprites without scaling the player', () => {
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

    expect(playerMesh?.scale.x).toBe(1);
    expect(playerMesh?.scale.y).toBe(1);
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

    expect(playerMesh?.position.x).toBeCloseTo(0.08);
    expect(playerMesh?.position.y).toBeCloseTo(-0.08);
    expect(enemyMesh?.position.x).toBeCloseTo(1.2);
    expect(enemyMesh?.position.y).toBeCloseTo(-1.2);
    expect(bossMesh?.position.x).toBeCloseTo(-2.4);
    expect(bossMesh?.position.y).toBeCloseTo(2.4);
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
          elapsedMs: 0
        },
        zone: { mode: 'disabled', margin: 0 },
        waveProgress: null,
        bossHud: null,
        weaponHud: null
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
          elapsedMs: 0
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
