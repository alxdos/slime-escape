import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { SnapshotPair } from '../sim/SimWorkerHost';

import { BOSS_GARGOYLE } from '../../shared/content/bosses';
import { SLIME_BUG } from '../../shared/content/enemies';
import type { SessionDefinition } from '../../shared/session';
import { PX_PER_WU } from '../../shared/sprite/spriteScale';
import { DEFAULT_PLAYER_VISUAL } from './playerVisuals';
import { createRenderer } from './Renderer';
import type { TextureMap } from './spritePreload';

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
    bossHud: null
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
    ...overrides
  };
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
        bossHud: null
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
