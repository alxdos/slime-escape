import * as THREE from 'three';

import { BOSS_ARCHETYPES } from '../../shared/content/bosses';
import { ENEMY_ARCHETYPES } from '../../shared/content/enemies';
import { WEAPON_ARCHETYPES, type WeaponArchetype } from '../../shared/content/weapons';
import type { RuntimeEvent } from '../../shared/events';
import type { ArenaConfig, SessionDefinition } from '../../shared/session';
import { PX_PER_WU } from '../../shared/sprite/spriteScale';
import type {
  BossSnapshot,
  DropSnapshot,
  EnemySnapshot,
  EntitySnapshot,
  FieldEffectSnapshot,
  PlayerSnapshot,
  ProjectileSnapshot,
  Snapshot
} from '../../shared/snapshot';
import { SNAPSHOT_INTERVAL_MS } from '../../shared/timing';
import type { SnapshotPair } from '../sim/SimWorkerHost';

import { BOSS_VISUALS } from './bossVisuals';
import { DROP_VISUALS } from './dropVisuals';
import { ENEMY_VISUALS } from './enemyVisuals';
import { fitCanvasToViewport } from './fitToViewport';
import {
  createImpactEffectStore,
  type DeathGhostEffect,
  type HitImpulseEffect,
  type SlimeDropletEffect
} from './ImpactEffectStore';
import { DEFAULT_PLAYER_VISUAL } from './playerVisuals';
import { PROJECTILE_VISUALS } from './projectileVisuals';
import {
  resolveRenderScale,
  type RenderScalePreset
} from './renderScale';
import type { SpriteVisualSpec } from './SpriteVisualSpec';
import type { TextureMap } from './spritePreload';

export type AimAccessor = () => { x: number; y: number } | null;

type RendererWindowTarget = Pick<Window, 'innerWidth' | 'innerHeight' | 'devicePixelRatio'>;

type WebGlRendererLike = Readonly<{
  setPixelRatio(value: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}>;

type CreateRendererBackendFn = (init: Readonly<{
  canvas: HTMLCanvasElement;
}>) => WebGlRendererLike;

type LoadTextureFn = (
  url: string,
  onLoad?: (texture: THREE.Texture) => void
) => THREE.Texture;

type DebugHud = Readonly<{
  update(snapshot: import('../../shared/snapshot').Snapshot | null): void;
  dispose(): void;
}>;

export type RendererInit = Readonly<{
  canvas: HTMLCanvasElement;
  renderScalePreset: RenderScalePreset;
  arena: ArenaConfig;
  session: Pick<SessionDefinition, 'backgrounds' | 'encounters'>;
  spriteTextures: TextureMap;
  getSnapshotPair: () => SnapshotPair;
  getAim?: AimAccessor;
  weaponRegistry?: Readonly<Record<string, WeaponArchetype>>;
  windowTarget?: RendererWindowTarget;
  createRendererBackend?: CreateRendererBackendFn;
  loadBackgroundTexture?: LoadTextureFn;
  createDebugHud?: () => DebugHud;
}>;

export type Renderer = Readonly<{
  render(): void;
  handleEvent(event: RuntimeEvent): void;
  fitToWindow(): void;
  applyScalePolicy(preset: RenderScalePreset): void;
  dispose(): void;
}>;

const ARENA_FLOOR_COLOR = 0x1b1f29;
const ARENA_BORDER_COLOR = 0x2a3142;
const CROSSHAIR_COLOR = 0xffe066;
const CROSSHAIR_OPACITY = 0.78;
const CROSSHAIR_OUTLINE_COLOR = 0x050505;
const CROSSHAIR_OUTLINE_OPACITY = 1;
const CROSSHAIR_OUTLINE_WIDTH_WU = 0.018;
const CROSSHAIR_OUTLINE_NAME = 'crosshair-outline';
const CROSSHAIR_OUTLINE_RENDER_ORDER = 20;
const CROSSHAIR_RENDER_ORDER = 21;
const AIM_RING_OUTLINE_COLOR = 0xd97706;
const AIM_RING_OUTLINE_OPACITY = 0.72;
const PROJECTILE_RADIUS_OUTLINE_OPACITY = 0.54;
const CROSSHAIR_SIZE_WU = 0.6;
const CROSSHAIR_THICKNESS_WU = 0.05;
const SCENE_BG = 0x05060a;
const ARENA_TINT_COLOR = 0x05060a;
const ARENA_TINT_OPACITY = 0.18;

const BACKGROUND_Z = -2;
const ENEMY_Z = 0;
const PROJECTILE_Z = 0.05;
const PROJECTILE_RADIUS_Z = -0.01;
const PROJECTILE_RADIUS_INDICATOR_NAME = 'projectile-radius-indicator';
const PROJECTILE_RADIUS_OUTLINE_NAME = 'projectile-radius-outline';
const CARRIER_REWARD_MARKER_NAME = 'carrier-reward-marker';
const STATUS_MARKER_NAME = 'status-effect-marker';
const DROP_Z = 0.03;
const FIELD_EFFECT_Z = -0.03;
const PICKUP_GHOST_Z = 0.12;
const ARC_PREVIEW_Z = 0.04;
const ARC_PREVIEW_RADIUS_WU = 0.18;
const SLIME_STAIN_Z = -0.25;
const DEATH_GHOST_Z = 0.045;
const DROP_PULSE_HZ = 1.6;
const DROP_PULSE_AMPLITUDE = 0.15;
const PROJECTILE_GROUNDED_PULSE_AMPLITUDE = 0.1;
const SLIME_BREATH_HZ = 0.85;
const SLIME_BREATH_AMPLITUDE = 0.07;
const SLIME_BREATH_VERTICAL_RATIO = 0.82;
const BOSS_BREATH_AMPLITUDE = 0.045;
const ZONE_OVERLAY_Z = 0.2;
const ZONE_CORNER_RADIUS_FACTOR = 0.25;
const ZONE_FEATHER_WU = 1.5;
const PICKUP_GHOST_TTL_MS = 280;

type EntityMeshEntry = {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
};

type PickupGhostEntry = EntityMeshEntry & {
  readonly id: number;
  readonly pickerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly startedAtMs: number;
  readonly expiresAtMs: number;
};

type CharacterSnapGrid = Readonly<{
  stepX: number;
  stepY: number;
}>;

export function createRenderer(init: RendererInit): Renderer {
  const weaponRegistry = init.weaponRegistry ?? WEAPON_ARCHETYPES;
  const windowTarget = init.windowTarget ?? window;

  const renderer =
    (init.createRendererBackend ?? createThreeRendererBackend)({
      canvas: init.canvas
    });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BG);

  const halfW = init.arena.width / 2;
  const halfH = init.arena.height / 2;

  const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 10);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  const arenaBackground = createArenaBackground({
    arena: init.arena,
    session: init.session,
    loadTexture: init.loadBackgroundTexture ?? loadBackgroundTexture
  });
  scene.add(arenaBackground.mesh);

  const arenaGeometry = new THREE.PlaneGeometry(init.arena.width, init.arena.height);
  const arenaMaterial = new THREE.MeshBasicMaterial({
    color: ARENA_TINT_COLOR,
    transparent: true,
    opacity: ARENA_TINT_OPACITY,
    depthWrite: false
  });
  const arenaMesh = new THREE.Mesh(arenaGeometry, arenaMaterial);
  arenaMesh.position.z = -1;
  scene.add(arenaMesh);

  const arenaBorder = new THREE.LineSegments(
    new THREE.EdgesGeometry(arenaGeometry),
    new THREE.LineBasicMaterial({ color: ARENA_BORDER_COLOR })
  );
  arenaBorder.position.z = -0.5;
  scene.add(arenaBorder);

  const playerEntry = createSpriteMesh(
    DEFAULT_PLAYER_VISUAL,
    requireSpriteTexture(init.spriteTextures, DEFAULT_PLAYER_VISUAL.archetypeId, 'player'),
    ENEMY_Z
  );
  const playerMesh = playerEntry.mesh;
  playerMesh.add(createStatusMarker(DEFAULT_PLAYER_VISUAL.worldSize.height));
  playerMesh.visible = false;
  scene.add(playerMesh);

  const crosshair = createCrosshair();
  crosshair.visible = false;
  scene.add(crosshair);

  const arcPreview = createArcPreview();
  scene.add(arcPreview);

  const zoneOverlay = createZoneOverlay(init.arena);
  scene.add(zoneOverlay.mesh);

  const debugHud = (init.createDebugHud ?? createDebugHud)();
  let currentRenderScalePreset = init.renderScalePreset;
  let characterSnapGrid: CharacterSnapGrid | null = null;
  let lastRenderNowMs = 0;
  const impactEffects = createImpactEffectStore({
    enemyRegistry: ENEMY_ARCHETYPES,
    bossRegistry: BOSS_ARCHETYPES,
    weaponRegistry
  });
  const projectileHideDistance = Math.max(
    DEFAULT_PLAYER_VISUAL.worldSize.width,
    DEFAULT_PLAYER_VISUAL.worldSize.height
  ) / 2;

  const enemyMeshes = new Map<number, EntityMeshEntry>();
  const bossMeshes = new Map<number, EntityMeshEntry>();
  const projectileMeshes = new Map<number, EntityMeshEntry>();
  const dropMeshes = new Map<number, EntityMeshEntry>();
  const fieldEffectMeshes = new Map<number, EntityMeshEntry>();
  const pickupGhostMeshes = new Map<number, PickupGhostEntry>();
  const slimeDropletMeshes = new Map<number, EntityMeshEntry>();
  const deathGhostMeshes = new Map<number, EntityMeshEntry>();

  function applyResolvedScalePolicy(
    preset: RenderScalePreset,
    cssWidthPx: number,
    cssHeightPx: number
  ): void {
    currentRenderScalePreset = preset;
    const resolution = resolveRenderScale({
      preset,
      cssWidthPx,
      cssHeightPx,
      devicePixelRatio: windowTarget.devicePixelRatio
    });
    characterSnapGrid =
      preset === 'low'
        ? createCharacterSnapGrid(
            init.arena,
            resolution.backingWidthPx,
            resolution.backingHeightPx
          )
        : null;
    init.canvas.style.imageRendering = resolution.imageRendering;
    renderer.setPixelRatio(resolution.pixelRatio);
    renderer.setSize(resolution.backingWidthPx, resolution.backingHeightPx, false);
  }

  function applyScalePolicy(preset: RenderScalePreset): void {
    const cssSize = readCanvasCssSize(init.canvas);
    applyResolvedScalePolicy(preset, cssSize.width, cssSize.height);
  }

  function fitToWindow(): void {
    const fit = fitCanvasToViewport({
      viewportWidth: windowTarget.innerWidth,
      viewportHeight: windowTarget.innerHeight,
      arenaAspect: init.arena.width / init.arena.height
    });
    if (fit.width <= 0 || fit.height <= 0) return;
    init.canvas.style.width = `${fit.width}px`;
    init.canvas.style.height = `${fit.height}px`;
    applyResolvedScalePolicy(currentRenderScalePreset, fit.width, fit.height);
  }

  fitToWindow();

  function disposeEntityMesh(entry: EntityMeshEntry): void {
    scene.remove(entry.mesh);
    disposeObjectTree(entry.mesh);
  }

  function ensureBossMesh(snap: BossSnapshot): EntityMeshEntry {
    const existing = bossMeshes.get(snap.id);
    if (existing !== undefined) return existing;
    const visual = requireVisualSpec(BOSS_VISUALS, snap.archetypeId, 'boss');
    const entry = createSpriteMesh(
      visual,
      requireSpriteTexture(init.spriteTextures, snap.archetypeId, 'boss'),
      ENEMY_Z
    );
    entry.mesh.add(createStatusMarker(visual.worldSize.height));
    scene.add(entry.mesh);
    bossMeshes.set(snap.id, entry);
    return entry;
  }

  function ensureEnemyMesh(snap: EnemySnapshot): EntityMeshEntry {
    const existing = enemyMeshes.get(snap.id);
    if (existing !== undefined) return existing;
    const visual = requireVisualSpec(ENEMY_VISUALS, snap.archetypeId, 'enemy');
    const entry = createSpriteMesh(
      visual,
      requireSpriteTexture(init.spriteTextures, snap.archetypeId, 'enemy'),
      ENEMY_Z
    );
    entry.mesh.add(createCarrierRewardMarker(visual.worldSize.height));
    entry.mesh.add(createStatusMarker(visual.worldSize.height));
    scene.add(entry.mesh);
    enemyMeshes.set(snap.id, entry);
    return entry;
  }

  function ensureProjectileMesh(snap: ProjectileSnapshot): EntityMeshEntry {
    const existing = projectileMeshes.get(snap.id);
    if (existing !== undefined) return existing;
    const entry = createSpriteMesh(
      requireVisualSpec(PROJECTILE_VISUALS, snap.weaponArchetypeId, 'projectile'),
      requireSpriteTexture(init.spriteTextures, snap.weaponArchetypeId, 'projectile'),
      PROJECTILE_Z
    );
    entry.mesh.add(createProjectileRadiusIndicator());
    scene.add(entry.mesh);
    projectileMeshes.set(snap.id, entry);
    return entry;
  }

  function ensureDropMesh(snap: DropSnapshot): EntityMeshEntry {
    const existing = dropMeshes.get(snap.id);
    if (existing !== undefined) return existing;
    const entry = createSpriteMesh(
      requireVisualSpec(DROP_VISUALS, snap.archetypeId, 'drop'),
      requireSpriteTexture(init.spriteTextures, snap.archetypeId, 'drop'),
      DROP_Z
    );
    scene.add(entry.mesh);
    dropMeshes.set(snap.id, entry);
    return entry;
  }

  function ensureFieldEffectMesh(snap: FieldEffectSnapshot): EntityMeshEntry {
    const existing = fieldEffectMeshes.get(snap.id);
    if (existing !== undefined) return existing;
    const geometry = new THREE.CircleGeometry(1, 64);
    const material = new THREE.MeshBasicMaterial({
      color: 0x5ee6ff,
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = FIELD_EFFECT_Z;
    scene.add(mesh);
    const entry = { mesh, geometry, material };
    fieldEffectMeshes.set(snap.id, entry);
    return entry;
  }

  function spawnPickupGhost(
    event: Extract<RuntimeEvent, { kind: 'dropPickup' }>,
    nowMs: number
  ): void {
    const entry = createSpriteMesh(
      requireVisualSpec(DROP_VISUALS, event.archetypeId, 'drop'),
      requireSpriteTexture(init.spriteTextures, event.archetypeId, 'drop'),
      PICKUP_GHOST_Z
    );
    entry.mesh.position.x = event.x;
    entry.mesh.position.y = event.y;
    scene.add(entry.mesh);
    pickupGhostMeshes.set(event.entityId, {
      ...entry,
      id: event.entityId,
      pickerId: event.pickerId,
      startX: event.x,
      startY: event.y,
      startedAtMs: nowMs,
      expiresAtMs: nowMs + PICKUP_GHOST_TTL_MS
    });
  }

  return {
    render(): void {
      const pair = init.getSnapshotPair();
      lastRenderNowMs = pair.nowMs;
      impactEffects.update(pair.nowMs);
      const impactSnapshot = impactEffects.snapshot();
      const hitImpulsesByTarget = indexHitImpulses(impactSnapshot.hitImpulses);
      const alpha = computeAlpha(pair);
      updatePlayer(playerMesh, pair, alpha, characterSnapGrid);
      updateEntities(
        pair,
        alpha,
        (e): e is EnemySnapshot => e.kind === 'enemy',
        enemyMeshes,
        ensureEnemyMesh,
        disposeEntityMesh,
        characterSnapGrid,
        (entry, entity) =>
          applyEnemyPresentation(
            entry.mesh,
            entity,
            pair.nowMs,
            hitImpulsesByTarget.get(entity.id)
          )
      );
      updateEntities(
        pair,
        alpha,
        (e): e is BossSnapshot => e.kind === 'boss',
        bossMeshes,
        ensureBossMesh,
        disposeEntityMesh,
        characterSnapGrid,
        (entry, entity) => {
          applySlimePresentation(
            entry.mesh,
            pair.nowMs,
            entity.id,
            BOSS_BREATH_AMPLITUDE,
            hitImpulsesByTarget.get(entity.id)
          );
          applyStatusMarker(entry.mesh, entity.statusEffects ?? [], pair.nowMs);
        }
      );
      updateEntities(
        pair,
        alpha,
        (e): e is ProjectileSnapshot => e.kind === 'projectile',
        projectileMeshes,
        ensureProjectileMesh,
        disposeEntityMesh,
        null,
        (entry, entity) =>
          applyProjectilePresentation(
            entry.mesh,
            entity,
            weaponRegistry,
            projectileHideDistance
          )
      );
      updateEntities(
        pair,
        alpha,
        (e): e is DropSnapshot => e.kind === 'drop',
        dropMeshes,
        ensureDropMesh,
        disposeEntityMesh
      );
      updateEntities(
        pair,
        alpha,
        (e): e is FieldEffectSnapshot => e.kind === 'fieldEffect',
        fieldEffectMeshes,
        ensureFieldEffectMesh,
        disposeEntityMesh,
        null,
        (entry, entity) => applyFieldEffectPresentation(entry.mesh, entity, pair.nowMs)
      );
      pulseDropMeshes(dropMeshes, pair.nowMs);
      updatePickupGhostMeshes(pickupGhostMeshes, pair.curr, pair.nowMs, disposeEntityMesh);
      updateCrosshair(crosshair, init.getAim);
      updateArcPreview(arcPreview, pair.curr, init.getAim, weaponRegistry);
      updateZoneOverlay(zoneOverlay, pair, alpha);
      updateSlimeDropletMeshes(
        impactSnapshot.droplets,
        slimeDropletMeshes,
        scene,
        disposeEntityMesh
      );
      updateDeathGhostMeshes(
        impactSnapshot.deathGhosts,
        deathGhostMeshes,
        scene,
        init.spriteTextures,
        disposeEntityMesh
      );
      arenaBackground.setEncounterId(pair.curr?.encounter?.id ?? null);
      debugHud.update(pair.curr);
      renderer.render(scene, camera);
    },
    handleEvent(event: RuntimeEvent): void {
      impactEffects.handleEvent(event, lastRenderNowMs);
      if (event.kind === 'dropPickup') {
        spawnPickupGhost(event, lastRenderNowMs);
      }
    },
    fitToWindow,
    applyScalePolicy,
    dispose(): void {
      scene.remove(arenaMesh);
      scene.remove(arenaBorder);
      scene.remove(arenaBackground.mesh);
      disposeEntityMesh(playerEntry);
      scene.remove(crosshair);
      disposeArcPreview(arcPreview);
      scene.remove(zoneOverlay.mesh);
      for (const entry of enemyMeshes.values()) disposeEntityMesh(entry);
      enemyMeshes.clear();
      for (const entry of bossMeshes.values()) disposeEntityMesh(entry);
      bossMeshes.clear();
      for (const entry of projectileMeshes.values()) disposeEntityMesh(entry);
      projectileMeshes.clear();
      for (const entry of dropMeshes.values()) disposeEntityMesh(entry);
      dropMeshes.clear();
      for (const entry of fieldEffectMeshes.values()) disposeEntityMesh(entry);
      fieldEffectMeshes.clear();
      for (const entry of pickupGhostMeshes.values()) disposeEntityMesh(entry);
      pickupGhostMeshes.clear();
      for (const entry of slimeDropletMeshes.values()) disposeEntityMesh(entry);
      slimeDropletMeshes.clear();
      for (const entry of deathGhostMeshes.values()) disposeEntityMesh(entry);
      deathGhostMeshes.clear();
      arenaGeometry.dispose();
      arenaMaterial.dispose();
      arenaBackground.dispose();
      disposeCrosshair(crosshair);
      arenaBorder.geometry.dispose();
      (arenaBorder.material as THREE.Material).dispose();
      zoneOverlay.dispose();
      impactEffects.clear();
      debugHud.dispose();
      renderer.dispose();
    }
  };
}

type ArenaBackground = Readonly<{
  mesh: THREE.Mesh;
  setEncounterId(encounterId: string | null): void;
  dispose(): void;
}>;

function createArenaBackground(init: Readonly<{
  arena: ArenaConfig;
  session: Pick<SessionDefinition, 'backgrounds' | 'encounters'>;
  loadTexture: LoadTextureFn;
}>): ArenaBackground {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({ color: ARENA_FLOOR_COLOR });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = BACKGROUND_Z;
  mesh.scale.set(init.arena.width, init.arena.height, 1);

  let activeEncounterId: string | null = null;
  let activeTexture: THREE.Texture | null = null;

  const textureById = new Map<string, THREE.Texture>();
  for (const background of init.session.backgrounds) {
    const texture = init.loadTexture(background.imageUrl, (loaded) => {
      prepareBackgroundTexture(loaded);
      if (activeTexture === loaded) {
        applyBackgroundPattern(loaded);
      }
    });
    prepareBackgroundTexture(texture);
    textureById.set(background.id, texture);
  }

  const backgroundIdByEncounterId = new Map<string, string | null>();
  for (const encounter of init.session.encounters) {
    backgroundIdByEncounterId.set(encounter.id, encounter.backgroundId);
  }

  function applyTexture(texture: THREE.Texture | null): void {
    if (activeTexture === texture) return;
    activeTexture = texture;
    material.map = texture;
    material.color.set(texture === null ? ARENA_FLOOR_COLOR : 0xffffff);
    applyBackgroundPattern(texture);
    material.needsUpdate = true;
  }

  function applyBackgroundPattern(texture: THREE.Texture | null): void {
    mesh.scale.set(init.arena.width, init.arena.height, 1);
    if (texture === null) {
      return;
    }

    const sourceSize = readTextureSourceSize(texture);
    if (sourceSize === null) {
      return;
    }
    const tileWidthWu = sourceSize.width / PX_PER_WU;
    const tileHeightWu = sourceSize.height / PX_PER_WU;
    texture.repeat.set(init.arena.width / tileWidthWu, init.arena.height / tileHeightWu);
    texture.needsUpdate = true;
  }

  return {
    mesh,
    setEncounterId(encounterId: string | null): void {
      if (activeEncounterId === encounterId) return;
      activeEncounterId = encounterId;
      if (encounterId === null) {
        applyTexture(null);
        return;
      }
      const backgroundId = backgroundIdByEncounterId.get(encounterId) ?? null;
      if (backgroundId === null) {
        applyTexture(null);
        return;
      }
      const texture = textureById.get(backgroundId);
      if (texture === undefined) {
        throw new Error(
          `background texture missing for background "${backgroundId}" in encounter "${encounterId}"`
        );
      }
      applyTexture(texture);
    },
    dispose(): void {
      geometry.dispose();
      material.dispose();
      for (const texture of textureById.values()) {
        texture.dispose();
      }
    }
  };
}

function loadBackgroundTexture(
  url: string,
  onLoad?: (texture: THREE.Texture) => void
): THREE.Texture {
  return new THREE.TextureLoader().load(url, onLoad);
}

function prepareBackgroundTexture(texture: THREE.Texture): void {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  if (readTextureSourceSize(texture) !== null) {
    texture.needsUpdate = true;
  }
}

function readTextureSourceSize(texture: THREE.Texture): Readonly<{
  width: number;
  height: number;
}> | null {
  const image = texture.image as Partial<Readonly<{ width: number; height: number }>> | undefined;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function createSpriteMesh(
  visual: SpriteVisualSpec,
  texture: THREE.Texture,
  z: number
): EntityMeshEntry {
  const geometry = new THREE.PlaneGeometry(visual.worldSize.width, visual.worldSize.height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = z;
  return { mesh, geometry, material };
}

function createProjectileRadiusIndicator(): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(1, 48);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffd166,
    transparent: true,
    opacity: 0.14,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = PROJECTILE_RADIUS_INDICATOR_NAME;
  mesh.position.z = PROJECTILE_RADIUS_Z;
  mesh.add(createRadiusOutlineMesh(1.01, 1.09, PROJECTILE_RADIUS_OUTLINE_NAME));
  mesh.visible = false;
  return mesh;
}

function createRadiusOutlineMesh(innerRadius: number, outerRadius: number, name: string): THREE.Mesh {
  return createRadiusOutlineMeshWithColor(
    innerRadius,
    outerRadius,
    name,
    AIM_RING_OUTLINE_COLOR,
    PROJECTILE_RADIUS_OUTLINE_OPACITY
  );
}

function createRadiusOutlineMeshWithColor(
  innerRadius: number,
  outerRadius: number,
  name: string,
  color: number,
  opacity: number
): THREE.Mesh {
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 48);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.z = -0.002;
  return mesh;
}

function createCarrierRewardMarker(enemyHeight: number): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(0.13, 4);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffd166,
    transparent: true,
    opacity: 0.92,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = CARRIER_REWARD_MARKER_NAME;
  mesh.position.y = enemyHeight / 2 + 0.18;
  mesh.position.z = 0.04;
  mesh.rotation.z = Math.PI / 4;
  mesh.visible = false;
  return mesh;
}

function createStatusMarker(entityHeight: number): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.16, 0.21, 24);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff6b35,
    transparent: true,
    opacity: 0.88,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = STATUS_MARKER_NAME;
  mesh.position.y = entityHeight / 2 + 0.42;
  mesh.position.z = 0.05;
  mesh.visible = false;
  return mesh;
}

function applyEnemyPresentation(
  mesh: THREE.Mesh,
  entity: EnemySnapshot,
  nowMs: number,
  hitImpulse: HitImpulseEffect | undefined
): void {
  applySlimePresentation(mesh, nowMs, entity.id, SLIME_BREATH_AMPLITUDE, hitImpulse);
  const marker = mesh.children.find((child) => child.name === CARRIER_REWARD_MARKER_NAME);
  if (marker !== undefined) marker.visible = entity.carrierDropMarker === 'reward';
  applyStatusMarker(mesh, entity.statusEffects ?? [], nowMs);
}

function applyStatusMarker(
  mesh: THREE.Mesh,
  statusEffects: ReadonlyArray<Readonly<{ kind: 'burn' | 'slow' | 'poison' }>>,
  nowMs: number
): void {
  const marker = mesh.children.find(
    (child): child is THREE.Mesh =>
      child instanceof THREE.Mesh && child.name === STATUS_MARKER_NAME
  );
  if (marker === undefined) return;
  const first = statusEffects[0] ?? null;
  marker.visible = first !== null;
  if (first === null) return;
  const material = marker.material;
  if (!Array.isArray(material) && material instanceof THREE.MeshBasicMaterial) {
    material.color.setHex(statusColor(first.kind));
    material.opacity = 0.62 + 0.26 * (0.5 + 0.5 * Math.sin(nowMs / 90));
  }
}

function statusColor(kind: 'burn' | 'slow' | 'poison'): number {
  switch (kind) {
    case 'burn':
      return 0xff6b35;
    case 'slow':
      return 0x5ee6ff;
    case 'poison':
      return 0xa7f070;
  }
}

function applyFieldEffectPresentation(
  mesh: THREE.Mesh,
  snap: FieldEffectSnapshot,
  nowMs: number
): void {
  mesh.scale.set(snap.radius, snap.radius, 1);
  const material = mesh.material;
  if (!Array.isArray(material) && material instanceof THREE.MeshBasicMaterial) {
    material.opacity = 0.13 + 0.07 * (0.5 + 0.5 * Math.sin(nowMs / 140 + snap.id));
  }
}

function applyProjectilePresentation(
  mesh: THREE.Mesh,
  snap: ProjectileSnapshot,
  weaponRegistry: Readonly<Record<string, WeaponArchetype>>,
  hideDistance: number
): boolean {
  const archetype = weaponRegistry[snap.weaponArchetypeId];
  const visual = archetype?.projectile.visual;
  const travelAngle = visual?.rotateWhileFlying === false ? 0 : snap.visualState.angleRadians;
  mesh.rotation.z = travelAngle + snap.visualState.spinRadians;

  const pulse =
    snap.state === 'grounded' && visual?.pulseWhenGrounded === true
      ? 1 +
        PROJECTILE_GROUNDED_PULSE_AMPLITUDE *
          Math.sin(snap.visualState.pulsePhase * Math.PI * 2)
      : 1;
  mesh.scale.set(pulse, pulse, 1);

  const material = mesh.material;
  if (!Array.isArray(material) && material instanceof THREE.MeshBasicMaterial) {
    material.opacity = snap.state === 'grounded' ? 0.86 : 0.95;
  }

  const shouldShow = shouldShowProjectile(snap, hideDistance);
  const radiusIndicator = mesh.children.find(
    (child): child is THREE.Mesh =>
      child instanceof THREE.Mesh && child.name === PROJECTILE_RADIUS_INDICATOR_NAME
  );
  if (radiusIndicator === undefined) return shouldShow;
  const showRadius =
    shouldShow &&
    snap.state === 'grounded' &&
    snap.explosionRadius !== null &&
    snap.explosionRadius > 0 &&
    visual?.explosionRadiusIndicator === true;
  radiusIndicator.visible = showRadius;
  if (!showRadius || snap.explosionRadius === null) return shouldShow;
  radiusIndicator.scale.set(snap.explosionRadius, snap.explosionRadius, 1);
  const radiusMaterial = radiusIndicator.material;
  if (!Array.isArray(radiusMaterial) && radiusMaterial instanceof THREE.MeshBasicMaterial) {
    const phase = 0.5 + 0.5 * Math.sin(snap.visualState.pulsePhase * Math.PI * 2);
    radiusMaterial.opacity = 0.08 + 0.08 * phase;
  }
  return shouldShow;
}

function shouldShowProjectile(
  snap: ProjectileSnapshot,
  hideDistance: number
): boolean {
  if (snap.state !== 'flying') return true;
  if (hideDistance <= 0) return true;
  const dx = snap.x - snap.originX;
  const dy = snap.y - snap.originY;
  return dx * dx + dy * dy >= hideDistance * hideDistance;
}

function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((child) => {
    const maybeMesh = child as Partial<
      Readonly<{ geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }>
    >;
    maybeMesh.geometry?.dispose();
    const material = maybeMesh.material;
    if (Array.isArray(material)) {
      for (const entry of material) entry.dispose();
    } else {
      material?.dispose();
    }
  });
}

function requireVisualSpec(
  visuals: Readonly<Record<string, SpriteVisualSpec>>,
  archetypeId: string,
  kind: 'player' | 'enemy' | 'boss' | 'projectile' | 'drop'
): SpriteVisualSpec {
  const visual = visuals[archetypeId];
  if (visual !== undefined) {
    return visual;
  }
  throw new Error(`${kind} visual missing for archetype "${archetypeId}"`);
}

function requireSpriteTexture(
  textures: TextureMap,
  archetypeId: string,
  kind: 'player' | 'enemy' | 'boss' | 'projectile' | 'drop'
): THREE.Texture {
  const texture = textures[archetypeId];
  if (texture !== undefined) {
    return texture;
  }
  throw new Error(`${kind} texture missing for archetype "${archetypeId}"`);
}

function createThreeRendererBackend(init: Readonly<{
  canvas: HTMLCanvasElement;
}>): WebGlRendererLike {
  return new THREE.WebGLRenderer({ canvas: init.canvas, antialias: true });
}

function readCanvasCssSize(canvas: HTMLCanvasElement): Readonly<{
  width: number;
  height: number;
}> {
  const styleWidth = parseCssPixels(canvas.style.width);
  const styleHeight = parseCssPixels(canvas.style.height);
  return {
    width: canvas.clientWidth > 0 ? canvas.clientWidth : styleWidth,
    height: canvas.clientHeight > 0 ? canvas.clientHeight : styleHeight
  };
}

function createCharacterSnapGrid(
  arena: ArenaConfig,
  backingWidthPx: number,
  backingHeightPx: number
): CharacterSnapGrid {
  return {
    stepX: arena.width / backingWidthPx,
    stepY: arena.height / backingHeightPx
  };
}

function parseCssPixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeAlpha(pair: SnapshotPair): number {
  const { prev, curr } = pair;
  if (!prev || !curr) return 1;
  const elapsedMs = pair.nowMs - pair.currReceivedAtMs;
  const renderSimTimeMs = curr.simTimeMs + elapsedMs - SNAPSHOT_INTERVAL_MS;
  const span = curr.simTimeMs - prev.simTimeMs;
  if (span <= 0) return 1;
  const raw = (renderSimTimeMs - prev.simTimeMs) / span;
  return Math.max(0, Math.min(1, raw));
}

function createCrosshair(): THREE.Group {
  const material = new THREE.MeshBasicMaterial({
    color: CROSSHAIR_COLOR,
    transparent: true,
    opacity: CROSSHAIR_OPACITY,
    depthTest: false,
    depthWrite: false
  });
  const horizontal = new THREE.Mesh(
    new THREE.PlaneGeometry(CROSSHAIR_SIZE_WU, CROSSHAIR_THICKNESS_WU),
    material
  );
  const vertical = new THREE.Mesh(
    new THREE.PlaneGeometry(CROSSHAIR_THICKNESS_WU, CROSSHAIR_SIZE_WU),
    material
  );
  const group = new THREE.Group();
  group.add(createCrosshairOutline());
  group.add(horizontal);
  group.add(vertical);
  group.position.z = 0.1;
  group.renderOrder = CROSSHAIR_RENDER_ORDER;
  horizontal.renderOrder = CROSSHAIR_RENDER_ORDER;
  vertical.renderOrder = CROSSHAIR_RENDER_ORDER;
  return group;
}

function createCrosshairOutline(): THREE.Mesh {
  const halfSize = CROSSHAIR_SIZE_WU / 2;
  const halfThickness = CROSSHAIR_THICKNESS_WU / 2;
  const shape = createPlusShape(
    halfSize + CROSSHAIR_OUTLINE_WIDTH_WU,
    halfThickness + CROSSHAIR_OUTLINE_WIDTH_WU
  );
  shape.holes.push(createPlusPath(halfSize, halfThickness, true));
  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshBasicMaterial({
    color: CROSSHAIR_OUTLINE_COLOR,
    transparent: true,
    opacity: CROSSHAIR_OUTLINE_OPACITY,
    depthTest: false,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = CROSSHAIR_OUTLINE_NAME;
  mesh.position.z = -0.001;
  mesh.renderOrder = CROSSHAIR_OUTLINE_RENDER_ORDER;
  return mesh;
}

function createPlusShape(halfLength: number, halfThickness: number): THREE.Shape {
  const shape = new THREE.Shape();
  addPlusPathPoints(shape, halfLength, halfThickness, false);
  return shape;
}

function createPlusPath(halfLength: number, halfThickness: number, reverse: boolean): THREE.Path {
  const path = new THREE.Path();
  addPlusPathPoints(path, halfLength, halfThickness, reverse);
  return path;
}

function addPlusPathPoints(
  path: THREE.Path,
  halfLength: number,
  halfThickness: number,
  reverse: boolean
): void {
  const points: THREE.Vector2[] = [
    new THREE.Vector2(-halfThickness, -halfLength),
    new THREE.Vector2(halfThickness, -halfLength),
    new THREE.Vector2(halfThickness, -halfThickness),
    new THREE.Vector2(halfLength, -halfThickness),
    new THREE.Vector2(halfLength, halfThickness),
    new THREE.Vector2(halfThickness, halfThickness),
    new THREE.Vector2(halfThickness, halfLength),
    new THREE.Vector2(-halfThickness, halfLength),
    new THREE.Vector2(-halfThickness, halfThickness),
    new THREE.Vector2(-halfLength, halfThickness),
    new THREE.Vector2(-halfLength, -halfThickness),
    new THREE.Vector2(-halfThickness, -halfThickness)
  ];
  const contour = reverse ? points.reverse() : points;
  path.moveTo(contour[0]!.x, contour[0]!.y);
  for (const point of contour.slice(1)) path.lineTo(point.x, point.y);
  path.closePath();
}

function createArcPreview(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.72, 1, 36);
  const material = new THREE.MeshBasicMaterial({
    color: CROSSHAIR_COLOR,
    transparent: true,
    opacity: 0.52,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = ARC_PREVIEW_Z;
  mesh.add(
    createRadiusOutlineMeshWithColor(
      0.62,
      1.1,
      'arc-preview-outline',
      AIM_RING_OUTLINE_COLOR,
      AIM_RING_OUTLINE_OPACITY
    )
  );
  mesh.scale.set(ARC_PREVIEW_RADIUS_WU, ARC_PREVIEW_RADIUS_WU, 1);
  mesh.visible = false;
  return mesh;
}

function disposeArcPreview(mesh: THREE.Mesh): void {
  mesh.removeFromParent();
  disposeObjectTree(mesh);
}

function disposeCrosshair(group: THREE.Group): void {
  for (const child of group.children) {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) {
        for (const m of material) m.dispose();
      } else {
        material.dispose();
      }
    }
  }
}

function findById<S extends EntitySnapshot>(
  snapshot: Snapshot | null,
  matches: (e: EntitySnapshot) => e is S,
  id: number
): S | null {
  if (!snapshot) return null;
  for (const entity of snapshot.entities) {
    if (matches(entity) && entity.id === id) return entity;
  }
  return null;
}

function updatePlayer(
  mesh: THREE.Mesh,
  pair: SnapshotPair,
  alpha: number,
  snapGrid: CharacterSnapGrid | null
): void {
  const { prev, curr } = pair;
  if (!curr) {
    mesh.visible = false;
    return;
  }
  const player = curr.entities.find((e) => e.kind === 'player');
  if (!player) {
    mesh.visible = false;
    return;
  }
  const prevPlayer = prev ? prev.entities.find((e) => e.kind === 'player') : undefined;
  if (!prevPlayer) {
    mesh.visible = true;
    setSnappedMeshPosition(mesh, player.x, player.y, 0, snapGrid);
    applyStatusMarker(mesh, player.statusEffects ?? [], pair.nowMs);
    return;
  }
  const x = prevPlayer.x + (player.x - prevPlayer.x) * alpha;
  const y = prevPlayer.y + (player.y - prevPlayer.y) * alpha;
  mesh.visible = true;
  setSnappedMeshPosition(mesh, x, y, 0, snapGrid);
  applyStatusMarker(mesh, player.statusEffects ?? [], pair.nowMs);
}

function updateEntities<S extends EntitySnapshot>(
  pair: SnapshotPair,
  alpha: number,
  matches: (e: EntitySnapshot) => e is S,
  table: Map<number, EntityMeshEntry>,
  ensure: (snap: S) => EntityMeshEntry,
  dispose: (entry: EntityMeshEntry) => void,
  snapGrid: CharacterSnapGrid | null = null,
  updateVisual?: (entry: EntityMeshEntry, snap: S) => boolean | void
): void {
  const { prev, curr } = pair;
  const aliveIds = new Set<number>();
  if (curr) {
    for (const entity of curr.entities) {
      if (!matches(entity)) continue;
      aliveIds.add(entity.id);
      const entry = ensure(entity);
      const prevSnap = findById(prev, matches, entity.id);
      if (prevSnap === null) {
        setSnappedMeshPosition(
          entry.mesh,
          entity.x,
          entity.y,
          entry.mesh.position.z,
          snapGrid
        );
      } else {
        const x = prevSnap.x + (entity.x - prevSnap.x) * alpha;
        const y = prevSnap.y + (entity.y - prevSnap.y) * alpha;
        setSnappedMeshPosition(entry.mesh, x, y, entry.mesh.position.z, snapGrid);
      }
      entry.mesh.visible = updateVisual?.(entry, entity) ?? true;
    }
  }
  for (const [id, entry] of table) {
    if (!aliveIds.has(id)) {
      dispose(entry);
      table.delete(id);
    }
  }
}

function setSnappedMeshPosition(
  mesh: THREE.Mesh,
  x: number,
  y: number,
  z: number,
  snapGrid: CharacterSnapGrid | null
): void {
  if (snapGrid === null) {
    mesh.position.set(x, y, z);
    return;
  }
  mesh.position.set(
    snapCoordinate(x, snapGrid.stepX),
    snapCoordinate(y, snapGrid.stepY),
    z
  );
}

function snapCoordinate(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function pulseDropMeshes(
  table: Map<number, { mesh: THREE.Mesh }>,
  nowMs: number
): void {
  // Visual-only breathing: drops do not have velocity in the snapshot,
  // so a tiny scale modulation keeps them readable on a busy arena.
  const phase = (nowMs / 1000) * DROP_PULSE_HZ * Math.PI * 2;
  const scale = 1 + DROP_PULSE_AMPLITUDE * Math.sin(phase);
  for (const entry of table.values()) {
    entry.mesh.scale.set(scale, scale, 1);
  }
}

function updatePickupGhostMeshes(
  ghosts: Map<number, PickupGhostEntry>,
  snapshot: Snapshot | null,
  nowMs: number,
  dispose: (entry: EntityMeshEntry) => void
): void {
  for (const [id, ghost] of ghosts) {
    if (nowMs >= ghost.expiresAtMs) {
      dispose(ghost);
      ghosts.delete(id);
      continue;
    }
    const picker = snapshot?.entities.find((entity) => entity.id === ghost.pickerId) ?? null;
    const targetX = picker?.x ?? ghost.startX;
    const targetY = picker?.y ?? ghost.startY;
    const span = ghost.expiresAtMs - ghost.startedAtMs;
    const t = span <= 0 ? 1 : Math.max(0, Math.min(1, (nowMs - ghost.startedAtMs) / span));
    const eased = easeOutCubic(t);
    ghost.mesh.position.x = ghost.startX + (targetX - ghost.startX) * eased;
    ghost.mesh.position.y = ghost.startY + (targetY - ghost.startY) * eased;
    ghost.mesh.position.z = PICKUP_GHOST_Z;
    const scale = Math.max(0.08, 1 - 0.85 * eased);
    ghost.mesh.scale.set(scale, scale, 1);
    if (ghost.material instanceof THREE.MeshBasicMaterial) {
      ghost.material.opacity = Math.max(0, 1 - eased);
    }
  }
}

function easeOutCubic(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function updateSlimeDropletMeshes(
  droplets: ReadonlyArray<SlimeDropletEffect>,
  table: Map<number, EntityMeshEntry>,
  scene: THREE.Scene,
  dispose: (entry: EntityMeshEntry) => void
): void {
  const aliveIds = new Set<number>();
  for (const droplet of droplets) {
    aliveIds.add(droplet.id);
    const entry = ensureSlimeDropletMesh(droplet, table, scene);
    const material = entry.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.opacity = droplet.opacity;
    }
    entry.mesh.position.set(droplet.x, droplet.y, SLIME_STAIN_Z);
    entry.mesh.scale.set(droplet.stainScale, droplet.stainScale, 1);
  }
  for (const [id, entry] of table) {
    if (!aliveIds.has(id)) {
      dispose(entry);
      table.delete(id);
    }
  }
}

function ensureSlimeDropletMesh(
  droplet: SlimeDropletEffect,
  table: Map<number, EntityMeshEntry>,
  scene: THREE.Scene
): EntityMeshEntry {
  const existing = table.get(droplet.id);
  if (existing !== undefined) return existing;
  const geometry = createIrregularBlobGeometry(droplet);
  const material = new THREE.MeshBasicMaterial({
    color: droplet.color,
    transparent: true,
    opacity: droplet.opacity,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = SLIME_STAIN_Z;
  scene.add(mesh);
  const entry: EntityMeshEntry = { mesh, geometry, material };
  table.set(droplet.id, entry);
  return entry;
}

function createIrregularBlobGeometry(droplet: SlimeDropletEffect): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < droplet.shape.length; i += 1) {
    const point = droplet.shape[i];
    if (point === undefined) continue;
    const x = Math.cos(point.angle) * droplet.radius * point.radiusScale;
    const y = Math.sin(point.angle) * droplet.radius * point.radiusScale;
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function updateDeathGhostMeshes(
  ghosts: ReadonlyArray<DeathGhostEffect>,
  table: Map<number, EntityMeshEntry>,
  scene: THREE.Scene,
  spriteTextures: TextureMap,
  dispose: (entry: EntityMeshEntry) => void
): void {
  const aliveIds = new Set<number>();
  for (const ghost of ghosts) {
    aliveIds.add(ghost.id);
    const entry = ensureDeathGhostMesh(ghost, table, scene, spriteTextures);
    const material = entry.material;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.opacity = ghost.opacity;
    } else if (material instanceof THREE.ShaderMaterial) {
      const uniform = material.uniforms.uOpacity;
      if (uniform !== undefined) {
        uniform.value = ghost.opacity;
      }
    }
    entry.mesh.position.set(ghost.x, ghost.y, DEATH_GHOST_Z);
    entry.mesh.scale.set(ghost.scale, ghost.scale, 1);
  }
  for (const [id, entry] of table) {
    if (!aliveIds.has(id)) {
      dispose(entry);
      table.delete(id);
    }
  }
}

function ensureDeathGhostMesh(
  ghost: DeathGhostEffect,
  table: Map<number, EntityMeshEntry>,
  scene: THREE.Scene,
  spriteTextures: TextureMap
): EntityMeshEntry {
  const existing = table.get(ghost.id);
  if (existing !== undefined) return existing;
  const visual =
    ghost.entityKind === 'enemy'
      ? requireVisualSpec(ENEMY_VISUALS, ghost.archetypeId, 'enemy')
      : requireVisualSpec(BOSS_VISUALS, ghost.archetypeId, 'boss');
  const texture = requireSpriteTexture(spriteTextures, ghost.archetypeId, ghost.entityKind);
  const geometry = new THREE.PlaneGeometry(visual.worldSize.width, visual.worldSize.height);
  const material = createDeathGhostMaterial(texture, ghost.opacity);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = DEATH_GHOST_Z;
  const entry: EntityMeshEntry = { mesh, geometry, material };
  scene.add(entry.mesh);
  table.set(ghost.id, entry);
  return entry;
}

function createDeathGhostMaterial(texture: THREE.Texture, opacity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMap: { value: texture },
      uOpacity: { value: opacity }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(uMap, vUv);
        float lum = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor = vec4(vec3(lum), texel.a * uOpacity);
      }
    `
  });
}

function applySlimePresentation(
  mesh: THREE.Mesh,
  nowMs: number,
  entityId: number,
  amplitude: number,
  hitImpulse: HitImpulseEffect | undefined
): void {
  const phase =
    (nowMs / 1000) * SLIME_BREATH_HZ * Math.PI * 2 +
    entityId * 1.61803398875;
  const breath = Math.sin(phase);
  const hitT = computeHitResponseT(hitImpulse, nowMs);
  const squashX = 1 + 0.16 * hitT;
  const squashY = 1 - 0.12 * hitT;
  mesh.scale.set(
    (1 + amplitude * breath) * squashX,
    (1 - amplitude * SLIME_BREATH_VERTICAL_RATIO * breath) * squashY,
    1
  );
  const material = mesh.material;
  if (Array.isArray(material) || !(material instanceof THREE.MeshBasicMaterial)) return;
  const flash = 1 + 0.55 * hitT;
  material.color.setRGB(flash, flash, flash);
}

function computeHitResponseT(
  hitImpulse: HitImpulseEffect | undefined,
  nowMs: number
): number {
  if (hitImpulse === undefined) return 0;
  const span = hitImpulse.expiresAtMs - hitImpulse.startedAtMs;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (hitImpulse.expiresAtMs - nowMs) / span));
}

function indexHitImpulses(
  hitImpulses: ReadonlyArray<HitImpulseEffect>
): Map<number, HitImpulseEffect> {
  const byTarget = new Map<number, HitImpulseEffect>();
  for (const impulse of hitImpulses) {
    byTarget.set(impulse.targetId, impulse);
  }
  return byTarget;
}

function updateCrosshair(group: THREE.Group, getAim: AimAccessor | undefined): void {
  if (!getAim) {
    group.visible = false;
    return;
  }
  const aim = getAim();
  if (!aim) {
    group.visible = false;
    return;
  }
  group.visible = true;
  group.position.x = aim.x;
  group.position.y = aim.y;
}

function updateArcPreview(
  mesh: THREE.Mesh,
  snapshot: Snapshot | null,
  getAim: AimAccessor | undefined,
  weaponRegistry: Readonly<Record<string, WeaponArchetype>>
): void {
  if (snapshot === null || getAim === undefined) {
    mesh.visible = false;
    return;
  }
  const aim = getAim();
  const weaponHud = snapshot.weaponHud;
  const player = snapshot.entities.find(
    (entity): entity is PlayerSnapshot => entity.kind === 'player'
  );
  if (
    aim === null ||
    weaponHud === null ||
    player === undefined ||
    weaponHud.selectedIndex === null
  ) {
    mesh.visible = false;
    return;
  }
  const selected = weaponHud.weapons.find((weapon) => weapon.index === weaponHud.selectedIndex);
  const archetype =
    selected === undefined ? undefined : weaponRegistry[selected.weaponArchetypeId];
  if (archetype === undefined) {
    mesh.visible = false;
    return;
  }
  const motion = archetype.projectile.motion;
  if (motion?.kind !== 'arc') {
    mesh.visible = false;
    return;
  }
  const dx = aim.x - player.x;
  const dy = aim.y - player.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    mesh.visible = false;
    return;
  }
  const travelDistance = Math.min(motion.range, len);
  mesh.visible = true;
  mesh.position.x = player.x + (dx / len) * travelDistance;
  mesh.position.y = player.y + (dy / len) * travelDistance;
  mesh.scale.set(
    Math.max(ARC_PREVIEW_RADIUS_WU, archetype.projectile.hitRadius),
    Math.max(ARC_PREVIEW_RADIUS_WU, archetype.projectile.hitRadius),
    1
  );
}

type ZoneOverlay = Readonly<{
  mesh: THREE.Mesh;
  setMargin(margin: number): void;
  dispose(): void;
}>;

function createZoneOverlay(arena: ArenaConfig): ZoneOverlay {
  const geometry = new THREE.PlaneGeometry(arena.width, arena.height);
  const cornerRadius = ZONE_CORNER_RADIUS_FACTOR * arena.height;
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uHalfSize: { value: new THREE.Vector2(arena.width / 2, arena.height / 2) },
      uMargin: { value: 0 },
      uCornerRadius: { value: cornerRadius },
      uFeather: { value: ZONE_FEATHER_WU }
    },
    vertexShader: `
      varying vec2 vWorldXY;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldXY = worldPos.xy;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      varying vec2 vWorldXY;
      uniform vec2 uHalfSize;
      uniform float uMargin;
      uniform float uCornerRadius;
      uniform float uFeather;

      float sdRoundedBox(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + vec2(r);
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
      }

      void main() {
        vec2 inner = max(uHalfSize - vec2(uMargin), vec2(0.001));
        float r = min(uCornerRadius, min(inner.x, inner.y));
        float d = sdRoundedBox(vWorldXY, inner, r);
        float alpha = clamp(smoothstep(0.0, uFeather, d), 0.0, 1.0);
        gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
      }
    `
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = ZONE_OVERLAY_Z;
  mesh.renderOrder = 1;

  return {
    mesh,
    setMargin(margin: number): void {
      const uniform = material.uniforms.uMargin;
      if (uniform === undefined) return;
      uniform.value = Math.max(0, margin);
    },
    dispose(): void {
      geometry.dispose();
      material.dispose();
    }
  };
}

function updateZoneOverlay(overlay: ZoneOverlay, pair: SnapshotPair, alpha: number): void {
  const { prev, curr } = pair;
  if (!curr) {
    overlay.setMargin(0);
    return;
  }
  if (!prev) {
    overlay.setMargin(curr.zone.margin);
    return;
  }
  const margin = prev.zone.margin + (curr.zone.margin - prev.zone.margin) * alpha;
  overlay.setMargin(margin);
}

function createDebugHud(): DebugHud {
  const div = document.createElement('div');
  div.style.cssText = [
    'position:fixed',
    'top:8px',
    'left:8px',
    'color:#9ad6ff',
    'font:12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
    'background:rgba(0,0,0,0.55)',
    'padding:6px 8px',
    'border-radius:4px',
    'pointer-events:none',
    'z-index:5',
    'white-space:pre'
  ].join(';');
  document.body.appendChild(div);

  return {
    update(snapshot): void {
      if (!snapshot) {
        div.textContent = '';
        return;
      }
      const lines: string[] = [];
      const enc = snapshot.encounter;
      lines.push(
        enc
          ? `encounter: ${enc.id} (${enc.type} #${enc.index})  ${(enc.elapsedMs / 1000).toFixed(1)}s`
          : 'encounter: —'
      );
      const wp = snapshot.waveProgress;
      if (wp !== null) {
        lines.push(`wave: ${wp.dispatched}/${wp.total}  alive=${wp.alive}`);
      }
      const player = snapshot.entities.find((e) => e.kind === 'player');
      lines.push(
        player !== undefined && player.kind === 'player'
          ? `hp:   ${player.hp}/${player.maxHp}`
          : 'hp:   —'
      );
      lines.push(`zone: ${snapshot.zone.mode}  margin=${snapshot.zone.margin.toFixed(2)}`);
      let drops = 0;
      for (const entity of snapshot.entities) {
        if (entity.kind === 'drop') drops += 1;
      }
      lines.push(`drops: ${drops}`);
      div.textContent = lines.join('\n');
    },
    dispose(): void {
      div.remove();
    }
  };
}
