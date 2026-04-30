import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { PublicArenaSnapshot } from '../../shared/publicArenaProtocol';
import type { TextureMap } from '../render/spritePreload';

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
    let snapshot: PublicArenaSnapshot | null = makeSnapshot();
    const backend = createRendererBackendHarness();
    const textures = createSpriteTextures();
    const renderer = createPublicArenaRenderer({
      canvas: makeCanvas(),
      arena: { width: 40, height: 40 },
      renderScalePreset: 'medium',
      spriteTextures: textures,
      getSnapshot: () => snapshot,
      windowTarget: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 },
      createRendererBackend: backend.factory
    });

    renderer.render();

    const scene = backend.lastScene();
    const players = findAllByName(scene, 'public-arena-player');
    const labels = findAllByName(scene, 'public-arena-level-label');
    const projectiles = findAllByName(scene, 'public-arena-projectile');
    const boss = players.find((player) => player.userData['formKind'] === 'boss');
    const slime = players.find((player) => player.userData['playerId'] === 'self');
    const selfRing = findAllByName(scene, 'public-arena-self-ring').find(
      (ring) => ring.visible
    );

    expect(players).toHaveLength(3);
    expect(labels.map((label) => label.userData['level']).sort()).toEqual([1, 2, 8]);
    expect(projectiles).toHaveLength(1);
    expect(projectiles[0]?.rotation.z).toBeCloseTo(Math.PI / 3);
    expect(boss?.userData['archetypeId']).toBe('boss-tower-sentinel');
    expect(materialMap(findSprite(boss))).toBe(textures['boss-tower-sentinel']);
    expect(slime?.userData['archetypeId']).toBe('slime-one-eye');
    expect(materialMap(findSprite(slime))).toBe(textures['slime-one-eye']);
    expect(selfRing?.parent?.userData['playerId']).toBe('self');

    const camera = backend.lastCamera();
    expect(camera.position.x).toBeCloseTo(4);
    expect(camera.position.y).toBeCloseTo(-4);

    snapshot = {
      ...makeSnapshot(),
      players: makeSnapshot().players.slice(0, 1),
      projectiles: []
    };
    renderer.render();

    expect(findAllByName(backend.lastScene(), 'public-arena-player')).toHaveLength(1);
    expect(findAllByName(backend.lastScene(), 'public-arena-projectile')).toHaveLength(0);

    renderer.dispose();
    expect(backend.disposeCalls()).toBe(1);
  });
});

function makeSnapshot(): PublicArenaSnapshot {
  return {
    simTimeMs: 1000,
    selfId: 'self',
    arena: { width: 40, height: 40, minX: -20, maxX: 20, minY: -20, maxY: 20 },
    population: 3,
    players: [
      {
        id: 'self',
        x: 8,
        y: -4,
        hp: 20,
        maxHp: 20,
        level: 1,
        form: { kind: 'slime', archetypeId: 'slime-one-eye' }
      },
      {
        id: 'other',
        x: 9,
        y: -3,
        hp: 24,
        maxHp: 24,
        level: 2,
        form: { kind: 'slime', archetypeId: 'slime-hornling' }
      },
      {
        id: 'boss',
        x: 11,
        y: -2,
        hp: 180,
        maxHp: 180,
        level: 8,
        form: { kind: 'boss', archetypeId: 'boss-tower-sentinel' }
      }
    ],
    projectiles: [
      {
        id: 'projectile-a',
        ownerId: 'self',
        weaponArchetypeId: 'rock-thrower',
        originX: 8,
        originY: -4,
        x: 8.8,
        y: -3.2,
        size: { width: 0.42, height: 0.42 },
        angleRadians: Math.PI / 3
      }
    ]
  };
}

function createSpriteTextures(): TextureMap {
  return {
    'slime-one-eye': new THREE.Texture(),
    'slime-hornling': new THREE.Texture(),
    'boss-tower-sentinel': new THREE.Texture(),
    'rock-thrower': new THREE.Texture()
  };
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
