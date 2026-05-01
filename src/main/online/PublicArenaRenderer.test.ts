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
import { ARC_PREVIEW_NAME } from '../render/arcPreview';
import { DEFAULT_PLAYER_VISUAL } from '../render/playerVisuals';
import type { TextureMap } from '../render/spritePreload';
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
    renderer.render();
    expect(arcPreview?.visible).toBe(false);

    snapshot = {
      ...makeSnapshot(),
      entities: makeSnapshot().entities.filter(
        (entity) => entity.kind === 'player' && entity.playerId === 'self'
      )
    };
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
      getSnapshot: () => null,
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
        formArchetypeId: 'slime-one-eye',
        weaponHud: makeWeaponHud(0)
      },
      {
        id: 2,
        kind: 'player',
        playerId: 'other',
        x: 9,
        y: -3,
        hp: 24,
        maxHp: 24,
        formArchetypeId: 'slime-hornling',
        weaponHud: makeWeaponHud(0)
      },
      {
        id: 3,
        kind: 'player',
        playerId: 'boss',
        x: 11,
        y: -2,
        hp: 180,
        maxHp: 180,
        formArchetypeId: PUBLIC_ARENA_BOSS_ARCHETYPE_ID,
        weaponHud: null
      },
      {
        id: 4,
        kind: 'player',
        playerId: 'hero',
        x: 7,
        y: -5,
        hp: 5,
        maxHp: 5,
        formArchetypeId: null,
        weaponHud: null
      },
      {
        id: 5,
        kind: 'projectile',
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
        arcEnd: { x: 12, y: -6 }
      }
    ],
    encounter: null,
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null
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
