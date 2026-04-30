import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  PUBLIC_ARENA_PRESENTATION_CONFIG,
  PUBLIC_ARENA_WORLD_BOUNDS
} from '../../shared/content/publicArena';
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
    const backgroundTexture = createBackgroundTexture();
    const activeBackground = requireActivePublicArenaBackground();
    const renderer = createPublicArenaRenderer({
      canvas: makeCanvas(),
      arena: PUBLIC_ARENA_PRESENTATION_CONFIG.arena,
      renderScalePreset: 'medium',
      spriteTextures: textures,
      getSnapshot: () => snapshot,
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
    const arcPreview = findAllByName(scene, 'public-arena-arc-preview')[0];
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
    expect(players).toHaveLength(3);
    expect(labels.map((label) => label.userData['level']).sort()).toEqual([1, 2, 8]);
    expect(projectiles).toHaveLength(1);
    expect(projectiles[0]?.rotation.z).toBeCloseTo(Math.PI / 3);
    expect(boss?.userData['archetypeId']).toBe('boss-tower-sentinel');
    expect(materialMap(findSprite(boss))).toBe(textures['boss-tower-sentinel']);
    expect(slime?.userData['archetypeId']).toBe('slime-one-eye');
    expect(materialMap(findSprite(slime))).toBe(textures['slime-one-eye']);
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

function requireActivePublicArenaBackground() {
  const background = PUBLIC_ARENA_PRESENTATION_CONFIG.backgrounds.find(
    (entry) => entry.id === PUBLIC_ARENA_PRESENTATION_CONFIG.activeBackgroundId
  );
  if (background === undefined) {
    throw new Error('expected public arena active background');
  }
  return background;
}

function makeSnapshot(): PublicArenaSnapshot {
  return {
    simTimeMs: 1000,
    selfId: 'self',
    arena: PUBLIC_ARENA_WORLD_BOUNDS,
    population: 3,
    players: [
      {
        id: 'self',
        x: 8,
        y: -4,
        hp: 10,
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
        ownerKind: 'player',
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

function createBackgroundTexture(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.image = { width: 480, height: 270 } as HTMLImageElement;
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
