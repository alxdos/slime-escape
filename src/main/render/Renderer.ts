import * as THREE from 'three';

import { BOSS_ARCHETYPES } from '../../shared/content/bosses';
import { DROP_ARCHETYPES, type DropArchetype } from '../../shared/content/drops';
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
  ProjectileSnapshot,
  Snapshot
} from '../../shared/snapshot';
import { SNAPSHOT_INTERVAL_MS } from '../../shared/timing';
import type { SnapshotPair } from '../sim/SimWorkerHost';

import { BOSS_VISUALS } from './bossVisuals';
import { ENEMY_VISUALS } from './enemyVisuals';
import { fitCanvasToViewport } from './fitToViewport';
import {
  createImpactEffectStore,
  type SlimeDropletEffect
} from './ImpactEffectStore';
import { DEFAULT_PLAYER_VISUAL } from './playerVisuals';
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
  dropRegistry?: Readonly<Record<string, DropArchetype>>;
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
const CROSSHAIR_SIZE_WU = 0.6;
const CROSSHAIR_THICKNESS_WU = 0.05;
const SCENE_BG = 0x05060a;
const ARENA_TINT_COLOR = 0x05060a;
const ARENA_TINT_OPACITY = 0.18;

const BACKGROUND_Z = -2;
const ENEMY_Z = 0;
const PROJECTILE_Z = 0.05;
const DROP_Z = 0.03;
const SLIME_STAIN_Z = 0.015;
const DROP_PULSE_HZ = 1.6;
const DROP_PULSE_AMPLITUDE = 0.15;
const SLIME_BREATH_HZ = 0.85;
const SLIME_BREATH_AMPLITUDE = 0.07;
const SLIME_BREATH_VERTICAL_RATIO = 0.82;
const BOSS_BREATH_AMPLITUDE = 0.045;
const ZONE_OVERLAY_Z = 0.2;
const ZONE_CORNER_RADIUS_FACTOR = 0.25;
const ZONE_FEATHER_WU = 1.5;

type EntityMeshEntry = {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
};

type CharacterSnapGrid = Readonly<{
  stepX: number;
  stepY: number;
}>;

export function createRenderer(init: RendererInit): Renderer {
  const weaponRegistry = init.weaponRegistry ?? WEAPON_ARCHETYPES;
  const dropRegistry = init.dropRegistry ?? DROP_ARCHETYPES;
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
  playerMesh.visible = false;
  scene.add(playerMesh);

  const crosshair = createCrosshair();
  crosshair.visible = false;
  scene.add(crosshair);

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

  const enemyMeshes = new Map<number, EntityMeshEntry>();
  const bossMeshes = new Map<number, EntityMeshEntry>();
  const projectileMeshes = new Map<number, EntityMeshEntry>();
  const dropMeshes = new Map<number, EntityMeshEntry>();
  const slimeDropletMeshes = new Map<number, EntityMeshEntry>();

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
    entry.geometry.dispose();
    entry.material.dispose();
  }

  function ensureBossMesh(snap: BossSnapshot): EntityMeshEntry {
    const existing = bossMeshes.get(snap.id);
    if (existing !== undefined) return existing;
    const entry = createSpriteMesh(
      requireVisualSpec(BOSS_VISUALS, snap.archetypeId, 'boss'),
      requireSpriteTexture(init.spriteTextures, snap.archetypeId, 'boss'),
      ENEMY_Z
    );
    scene.add(entry.mesh);
    bossMeshes.set(snap.id, entry);
    return entry;
  }

  function ensureEnemyMesh(snap: EnemySnapshot): EntityMeshEntry {
    const existing = enemyMeshes.get(snap.id);
    if (existing !== undefined) return existing;
    const entry = createSpriteMesh(
      requireVisualSpec(ENEMY_VISUALS, snap.archetypeId, 'enemy'),
      requireSpriteTexture(init.spriteTextures, snap.archetypeId, 'enemy'),
      ENEMY_Z
    );
    scene.add(entry.mesh);
    enemyMeshes.set(snap.id, entry);
    return entry;
  }

  function ensureProjectileMesh(snap: ProjectileSnapshot): EntityMeshEntry {
    const existing = projectileMeshes.get(snap.id);
    if (existing !== undefined) return existing;
    const archetype = weaponRegistry[snap.weaponArchetypeId];
    const radius = archetype?.projectileRadius ?? 0.1;
    const color = archetype?.color ?? 0xffffff;
    const geometry = new THREE.CircleGeometry(radius, 12);
    const material = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = PROJECTILE_Z;
    scene.add(mesh);
    const entry: EntityMeshEntry = { mesh, geometry, material };
    projectileMeshes.set(snap.id, entry);
    return entry;
  }

  function ensureDropMesh(snap: DropSnapshot): EntityMeshEntry {
    const existing = dropMeshes.get(snap.id);
    if (existing !== undefined) return existing;
    const archetype = dropRegistry[snap.archetypeId];
    const radius = archetype?.radius ?? 0.3;
    const color = archetype?.color ?? 0xffffff;
    const geometry = new THREE.CircleGeometry(radius, 24);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = DROP_Z;
    scene.add(mesh);
    const entry: EntityMeshEntry = { mesh, geometry, material };
    dropMeshes.set(snap.id, entry);
    return entry;
  }

  return {
    render(): void {
      const pair = init.getSnapshotPair();
      lastRenderNowMs = pair.nowMs;
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
        (mesh, entity) =>
          applySlimeBreath(mesh, pair.nowMs, entity.id, SLIME_BREATH_AMPLITUDE)
      );
      updateEntities(
        pair,
        alpha,
        (e): e is BossSnapshot => e.kind === 'boss',
        bossMeshes,
        ensureBossMesh,
        disposeEntityMesh,
        characterSnapGrid,
        (mesh, entity) =>
          applySlimeBreath(mesh, pair.nowMs, entity.id, BOSS_BREATH_AMPLITUDE)
      );
      updateEntities(
        pair,
        alpha,
        (e): e is ProjectileSnapshot => e.kind === 'projectile',
        projectileMeshes,
        ensureProjectileMesh,
        disposeEntityMesh
      );
      updateEntities(
        pair,
        alpha,
        (e): e is DropSnapshot => e.kind === 'drop',
        dropMeshes,
        ensureDropMesh,
        disposeEntityMesh
      );
      pulseDropMeshes(dropMeshes, pair.nowMs);
      updateCrosshair(crosshair, init.getAim);
      updateZoneOverlay(zoneOverlay, pair, alpha);
      impactEffects.update(pair.nowMs);
      updateSlimeDropletMeshes(
        impactEffects.snapshot().droplets,
        slimeDropletMeshes,
        scene,
        disposeEntityMesh
      );
      arenaBackground.setEncounterId(pair.curr?.encounter?.id ?? null);
      debugHud.update(pair.curr);
      renderer.render(scene, camera);
    },
    handleEvent(event: RuntimeEvent): void {
      impactEffects.handleEvent(event, lastRenderNowMs);
    },
    fitToWindow,
    applyScalePolicy,
    dispose(): void {
      scene.remove(arenaMesh);
      scene.remove(arenaBorder);
      scene.remove(arenaBackground.mesh);
      disposeEntityMesh(playerEntry);
      scene.remove(crosshair);
      scene.remove(zoneOverlay.mesh);
      for (const entry of enemyMeshes.values()) disposeEntityMesh(entry);
      enemyMeshes.clear();
      for (const entry of bossMeshes.values()) disposeEntityMesh(entry);
      bossMeshes.clear();
      for (const entry of projectileMeshes.values()) disposeEntityMesh(entry);
      projectileMeshes.clear();
      for (const entry of dropMeshes.values()) disposeEntityMesh(entry);
      dropMeshes.clear();
      for (const entry of slimeDropletMeshes.values()) disposeEntityMesh(entry);
      slimeDropletMeshes.clear();
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

function requireVisualSpec(
  visuals: Readonly<Record<string, SpriteVisualSpec>>,
  archetypeId: string,
  kind: 'player' | 'enemy' | 'boss'
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
  kind: 'player' | 'enemy' | 'boss'
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
  const material = new THREE.MeshBasicMaterial({ color: CROSSHAIR_COLOR });
  const horizontal = new THREE.Mesh(
    new THREE.PlaneGeometry(CROSSHAIR_SIZE_WU, CROSSHAIR_THICKNESS_WU),
    material
  );
  const vertical = new THREE.Mesh(
    new THREE.PlaneGeometry(CROSSHAIR_THICKNESS_WU, CROSSHAIR_SIZE_WU),
    material
  );
  const group = new THREE.Group();
  group.add(horizontal);
  group.add(vertical);
  group.position.z = 0.1;
  return group;
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
    return;
  }
  const x = prevPlayer.x + (player.x - prevPlayer.x) * alpha;
  const y = prevPlayer.y + (player.y - prevPlayer.y) * alpha;
  mesh.visible = true;
  setSnappedMeshPosition(mesh, x, y, 0, snapGrid);
}

function updateEntities<S extends EntitySnapshot>(
  pair: SnapshotPair,
  alpha: number,
  matches: (e: EntitySnapshot) => e is S,
  table: Map<number, EntityMeshEntry>,
  ensure: (snap: S) => EntityMeshEntry,
  dispose: (entry: EntityMeshEntry) => void,
  snapGrid: CharacterSnapGrid | null = null,
  updateVisual?: (mesh: THREE.Mesh, snap: S) => void
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
      updateVisual?.(entry.mesh, entity);
      entry.mesh.visible = true;
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

function applySlimeBreath(
  mesh: THREE.Mesh,
  nowMs: number,
  entityId: number,
  amplitude: number
): void {
  const phase =
    (nowMs / 1000) * SLIME_BREATH_HZ * Math.PI * 2 +
    entityId * 1.61803398875;
  const breath = Math.sin(phase);
  mesh.scale.set(
    1 + amplitude * breath,
    1 - amplitude * SLIME_BREATH_VERTICAL_RATIO * breath,
    1
  );
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
