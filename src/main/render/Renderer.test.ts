import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { SnapshotPair } from '../sim/SimWorkerHost';

import { BOSS_GARGOYLE } from '../../shared/content/bosses';
import { SLIME_BUG } from '../../shared/content/enemies';
import { HERO_VISUAL } from './playerVisuals';
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

  return {
    factory() {
      return {
        setPixelRatio(value: number): void {
          ops.push({ kind: 'pixelRatio', value });
        },
        setSize(width: number, height: number, updateStyle = true): void {
          ops.push({ kind: 'size', width, height, updateStyle });
        },
        render(): void {
          ops.push({ kind: 'render' });
        },
        dispose(): void {
          ops.push({ kind: 'dispose' });
        }
      };
    },
    ops,
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

function createSnapshotPairWithEntities(
  entities: SnapshotPair['curr'] extends infer T
    ? T extends { entities: infer E }
      ? E
      : never
    : never
): SnapshotPair {
  return {
    prev: null,
    curr: {
      simTimeMs: 0,
      entities,
      encounter: null,
      zone: { mode: 'disabled', margin: 0 },
      waveProgress: null,
      bossHud: null
    },
    currReceivedAtMs: 0,
    nowMs: 0
  };
}

function createSpriteTextures(
  overrides: Readonly<Record<string, THREE.Texture>> = {}
): TextureMap {
  return {
    [HERO_VISUAL.archetypeId]: new THREE.Texture(),
    ...overrides
  };
}

describe('createRenderer', () => {
  it('applies the low preset with quarter-resolution backing pixels and pixelated output on init', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();

    createRenderer({
      canvas,
      renderScalePreset: 'low',
      arena: { width: 16, height: 9 },
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

  it('throws when the required hero texture is missing before the first frame', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();

    expect(() =>
      createRenderer({
        canvas,
        renderScalePreset: 'medium',
        arena: { width: 16, height: 9 },
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
    ).toThrow('player texture missing for archetype "hero"');
  });

  it('throws when an entity snapshot references an unknown visual spec', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();
    const renderer = createRenderer({
      canvas,
      renderScalePreset: 'medium',
      arena: { width: 16, height: 9 },
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
