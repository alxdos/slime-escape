import { describe, expect, it } from 'vitest';

import type { SnapshotPair } from '../sim/SimWorkerHost';

import { createRenderer } from './Renderer';

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

describe('createRenderer', () => {
  it('applies the low preset with quarter-resolution backing pixels and pixelated output on init', () => {
    const canvas = createCanvasHarness();
    const backend = createRendererBackendHarness();

    createRenderer({
      canvas,
      renderScalePreset: 'low',
      arena: { width: 16, height: 9 },
      player: { radius: 0.5 },
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
      player: { radius: 0.5 },
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
      player: { radius: 0.5 },
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
});
