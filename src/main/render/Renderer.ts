import * as THREE from 'three';

import { BOSS_ARCHETYPES } from '../../shared/content/bosses';
import { ENEMY_ARCHETYPES } from '../../shared/content/enemies';
import { PET_ARCHETYPES } from '../../shared/content/pets';
import { WEAPON_ARCHETYPES, type WeaponArchetype } from '../../shared/content/weapons';
import type { RuntimeEvent } from '../../shared/events';
import type { ArenaConfig, PlayerSpawn, SessionDefinition } from '../../shared/session';
import { PX_PER_WU } from '../../shared/sprite/spriteScale';
import type {
  BossSnapshot,
  CompanionSnapshot,
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
import {
  createVisibleAreaCamera,
  type VisibleArea,
  type VisibleAreaCamera
} from '../visibleArea';
import type { VibeJamPortalDescriptor } from '../VibeJamPortalController';

import { BOSS_VISUALS } from './bossVisuals';
import { createArcPreview, updateArcPreview } from './arcPreview';
import {
  createCrosshair,
  disposeCrosshair,
  updateCrosshair,
  type AimAccessor
} from './crosshair';
import { DROP_VISUALS } from './dropVisuals';
import { ENEMY_VISUALS } from './enemyVisuals';
import { fitCanvasToViewport } from './fitToViewport';
import {
  createImpactEffectStore,
  type DeathGhostEffect,
  type HitImpulseEffect,
  type SlimeDropletEffect
} from './ImpactEffectStore';
import { createLandingTelegraphLayer } from './landingTelegraph';
import { PET_VISUALS } from './petVisuals';
import { DEFAULT_PLAYER_VISUAL } from './playerVisuals';
import { PROJECTILE_VISUALS } from './projectileVisuals';
import {
  applyProjectilePresentation,
  createProjectileRadiusIndicator
} from './projectilePresentation';
import {
  resolveRenderScale,
  type RenderScalePreset
} from './renderScale';
import type { SpriteVisualSpec } from './SpriteVisualSpec';
import type { TextureMap } from './spritePreload';
import {
  disposeVibeJamPortalMesh,
  updateVibeJamPortalMeshes,
  type VibeJamPortalMeshEntry
} from './vibeJamPortalPresentation';

export type { AimAccessor } from './crosshair';

type RendererWindowTarget = Pick<Window, 'innerWidth' | 'innerHeight' | 'devicePixelRatio'> &
  Partial<Pick<Window, 'matchMedia'>>;

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

type RendererSessionConfig = Pick<SessionDefinition, 'backgrounds' | 'encounters' | 'players'>;

export type RendererInit = Readonly<{
  canvas: HTMLCanvasElement;
  renderScalePreset: RenderScalePreset;
  arena: ArenaConfig;
  session: RendererSessionConfig;
  spriteTextures: TextureMap;
  selectedPetId?: string | null;
  visibleAreaCamera?: VisibleAreaCamera;
  getSnapshotPair: () => SnapshotPair;
  getPortalDescriptors?: () => ReadonlyArray<VibeJamPortalDescriptor>;
  getAim?: AimAccessor;
  weaponRegistry?: Readonly<Record<string, WeaponArchetype>>;
  windowTarget?: RendererWindowTarget;
  prefersReducedMotion?: boolean;
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
const SCENE_BG = 0x05060a;
const ARENA_TINT_COLOR = 0x05060a;
const ARENA_TINT_OPACITY = 0.18;

const BACKGROUND_Z = -2;
const ENEMY_Z = 0;
const PROJECTILE_Z = 0.05;
const CARRIER_REWARD_MARKER_NAME = 'carrier-reward-marker';
const STATUS_MARKER_NAME = 'status-effect-marker';
const DROP_Z = 0.03;
const FIELD_EFFECT_Z = -0.03;
const PICKUP_GHOST_Z = 0.12;
const SLIME_STAIN_Z = -0.25;
const SLIME_DROPLET_BASE_OPACITY = 0.82;
const DEATH_GHOST_Z = 0.045;
const COMPANION_Z = -0.02;
const COMPANION_HP_TRACK_NAME = 'companion-hp-track';
const COMPANION_HP_FILL_NAME = 'companion-hp-fill';
const COMPANION_HP_RESCUE_FILL_NAME = 'companion-hp-rescue-fill';
const PLAYER_HP_TRACK_NAME = 'player-hp-track';
const PLAYER_HP_FILL_NAME = 'player-hp-fill';
const COMPANION_WARNING_MARKER_NAME = 'companion-warning-marker';
const COMPANION_GHOST_AURA_NAME = 'companion-ghost-aura';
const COMPANION_RESCUE_RING_NAME = 'companion-rescue-ring';
const CHARACTER_HP_BAR_WIDTH_WU = 0.74;
const CHARACTER_HP_BAR_HEIGHT_WU = 0.07;
const CHARACTER_HP_BAR_OFFSET_WU = 0.22;
const CHARACTER_HP_TRACK_COLOR = 0x161b22;
const CHARACTER_HP_FILL_COLOR = 0x7ee7c8;
const COMPANION_HP_GHOST_FILL_COLOR = 0x9bd5ff;
const COMPANION_HP_RESCUE_FILL_COLOR = 0xffe066;
const COMPANION_WARNING_COLOR = 0xffe066;
const COMPANION_GHOST_COLOR = 0x9bd5ff;
const COMPANION_RESCUE_COLOR = 0xa7f070;
const DROP_PULSE_HZ = 1.6;
const DROP_PULSE_AMPLITUDE = 0.15;
const PLAYER_BREATH_HZ = 0.72;
const PLAYER_BREATH_AMPLITUDE = 0.028;
const PLAYER_BREATH_VERTICAL_RATIO = 0.64;
const PLAYER_MOVE_STRETCH_AMPLITUDE = 0.035;
const PLAYER_MOVE_BOB_AMPLITUDE_WU = 0.035;
const PLAYER_MOVE_LEAN_RADIANS = 0.08;
const PLAYER_PRESENTATION_MAX_SPEED = 6;
const SLIME_BREATH_HZ = 0.85;
const SLIME_BREATH_AMPLITUDE = 0.07;
const SLIME_BREATH_VERTICAL_RATIO = 0.82;
const BOSS_BREATH_AMPLITUDE = 0.045;
const COMPANION_BREATH_ENTITY_ID = 0;
const COMPANION_SPAWN_OFFSET_RADII = 2;
const COMPANION_FOLLOW_DISTANCE_RADII = 4;
const ZONE_OVERLAY_Z = 0.2;
const ZONE_OVERLAY_OPACITY = 0.86;
const ZONE_CORNER_RADIUS_FACTOR = 0.25;
const ZONE_FEATHER_WU = 1.5;
const PICKUP_GHOST_TTL_MS = 280;
const PORTAL_TRAVEL_MIN_PLAYER_SCALE = 0.08;

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

type CompanionEntry = EntityMeshEntry & {
  x: number;
  y: number;
  initialized: boolean;
  lastUpdatedAtMs: number | null;
};

type CharacterSnapGrid = Readonly<{
  stepX: number;
  stepY: number;
}>;

export function createRenderer(init: RendererInit): Renderer {
  const weaponRegistry = init.weaponRegistry ?? WEAPON_ARCHETYPES;
  const windowTarget = init.windowTarget ?? window;
  const prefersReducedMotion = init.prefersReducedMotion ?? prefersReducedMotionFromWindow(windowTarget);
  const primaryPlayer = init.session.players[0];

  const renderer =
    (init.createRendererBackend ?? createThreeRendererBackend)({
      canvas: init.canvas
    });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BG);

  const visibleAreaCamera =
    init.visibleAreaCamera ??
    createVisibleAreaCamera({
      arena: init.arena,
      profile: 'desktop',
      effectiveViewport: readRendererViewport(windowTarget),
      playerPosition: primaryPlayer.position
    });

  const camera = new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 10);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  applyCameraVisibleArea(camera, visibleAreaCamera.visibleArea());

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
  playerMesh.add(createPlayerHpBar(DEFAULT_PLAYER_VISUAL.worldSize.height));
  playerMesh.add(createStatusMarker(DEFAULT_PLAYER_VISUAL.worldSize.height));
  playerMesh.visible = false;
  scene.add(playerMesh);

  const companionEntry = createCompanionEntry(init.selectedPetId ?? null, init.spriteTextures);
  if (companionEntry !== null) {
    scene.add(companionEntry.mesh);
  }

  const crosshair = createCrosshair();
  crosshair.visible = false;
  scene.add(crosshair);

  const arcPreview = createArcPreview();
  scene.add(arcPreview);

  const zoneOverlay = createZoneOverlay(init.arena);
  scene.add(zoneOverlay.mesh);

  const debugHud = (init.createDebugHud ?? createNoopDebugHud)();
  let currentRenderScalePreset = init.renderScalePreset;
  let characterSnapGrid: CharacterSnapGrid | null = null;
  let lastRenderNowMs = 0;
  const impactEffects = createImpactEffectStore({
    enemyRegistry: ENEMY_ARCHETYPES,
    bossRegistry: BOSS_ARCHETYPES,
    weaponRegistry
  });
  const landingTelegraphs = createLandingTelegraphLayer(scene, weaponRegistry);
  const projectileHideDistance = Math.max(
    DEFAULT_PLAYER_VISUAL.worldSize.width,
    DEFAULT_PLAYER_VISUAL.worldSize.height
  ) / 2;

  const enemyMeshes = new Map<number, EntityMeshEntry>();
  const otherPlayerMeshes = new Map<number, EntityMeshEntry>();
  const companionMeshes = new Map<number, EntityMeshEntry>();
  const bossMeshes = new Map<number, EntityMeshEntry>();
  const projectileMeshes = new Map<number, EntityMeshEntry>();
  const dropMeshes = new Map<number, EntityMeshEntry>();
  const fieldEffectMeshes = new Map<number, EntityMeshEntry>();
  const pickupGhostMeshes = new Map<number, PickupGhostEntry>();
  const slimeDropletMeshes = new Map<number, EntityMeshEntry>();
  const deathGhostMeshes = new Map<number, EntityMeshEntry>();
  const portalMeshes = new Map<VibeJamPortalDescriptor['kind'], VibeJamPortalMeshEntry>();

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
            visibleAreaCamera.visibleArea(),
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
    visibleAreaCamera.resize(readRendererViewport(windowTarget));
    const visibleArea = visibleAreaCamera.visibleArea();
    const fit = fitCanvasToViewport({
      viewportWidth: windowTarget.innerWidth,
      viewportHeight: windowTarget.innerHeight,
      visibleAspect: visibleArea.width / visibleArea.height
    });
    if (fit.width <= 0 || fit.height <= 0) return;
    init.canvas.style.width = `${fit.width}px`;
    init.canvas.style.height = `${fit.height}px`;
    applyCameraVisibleArea(camera, visibleArea);
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

  function ensureOtherPlayerMesh(snap: PlayerSnapshot): EntityMeshEntry {
    const existing = otherPlayerMeshes.get(snap.id);
    if (existing !== undefined) return existing;
    const entry = createSpriteMesh(
      DEFAULT_PLAYER_VISUAL,
      requireSpriteTexture(init.spriteTextures, DEFAULT_PLAYER_VISUAL.archetypeId, 'player'),
      ENEMY_Z
    );
    entry.mesh.add(createPlayerHpBar(DEFAULT_PLAYER_VISUAL.worldSize.height));
    entry.mesh.add(createStatusMarker(DEFAULT_PLAYER_VISUAL.worldSize.height));
    scene.add(entry.mesh);
    otherPlayerMeshes.set(snap.id, entry);
    return entry;
  }

  function ensureCompanionMesh(snap: CompanionSnapshot): EntityMeshEntry {
    const existing = companionMeshes.get(snap.id);
    if (existing !== undefined) return existing;
    requirePetArchetype(snap.petArchetypeId);
    const visual = requireVisualSpec(PET_VISUALS, snap.petArchetypeId, 'pet');
    const entry = createSpriteMesh(
      visual,
      requireSpriteTexture(init.spriteTextures, snap.petArchetypeId, 'pet'),
      COMPANION_Z
    );
    entry.mesh.add(createCompanionHpBar(visual.worldSize.height));
    entry.mesh.add(createCompanionWarningMarker(visual.worldSize.height));
    entry.mesh.add(createCompanionGhostAura(visual.worldSize));
    entry.mesh.add(createCompanionRescueRing(visual.worldSize));
    scene.add(entry.mesh);
    companionMeshes.set(snap.id, entry);
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
      const portalDescriptors = init.getPortalDescriptors?.() ?? [];
      const hasRuntimeCompanion =
        pair.curr?.entities.some((entity) => entity.kind === 'companion') === true;
      visibleAreaCamera.follow(
        findInterpolatedPlayerPosition(pair, alpha) ?? primaryPlayer.position,
        pair.nowMs
      );
      applyCameraVisibleArea(camera, visibleAreaCamera.visibleArea());
      updatePlayer(playerMesh, pair, alpha, characterSnapGrid);
      applyPlayerPortalTravelPresentation(playerEntry, pair, portalDescriptors);
      const primaryPlayerSnapshot = findPlayerSnapshot(pair.curr);
      updateEntities(
        pair,
        alpha,
        (e): e is PlayerSnapshot =>
          e.kind === 'player' && e.id !== primaryPlayerSnapshot?.id,
        otherPlayerMeshes,
        ensureOtherPlayerMesh,
        disposeEntityMesh,
        characterSnapGrid,
        (entry, entity) =>
          applyOtherPlayerPresentation(
            entry.mesh,
            entity,
            pair.nowMs,
            hitImpulsesByTarget.get(entity.id)
          )
      );
      updateCompanion(
        companionEntry,
        pair,
        alpha,
        primaryPlayer,
        characterSnapGrid,
        hasRuntimeCompanion
      );
      updateEntities(
        pair,
        alpha,
        (e): e is CompanionSnapshot => e.kind === 'companion',
        companionMeshes,
        ensureCompanionMesh,
        disposeEntityMesh,
        characterSnapGrid,
        (entry, entity) =>
          applyCompanionPresentation(
            entry.mesh,
            entity,
            init.session,
            pair.nowMs,
            hitImpulsesByTarget.get(entity.id)
          )
      );
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
      landingTelegraphs.update(pair.curr, pair.nowMs);
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
      updateArcPreview(arcPreview, {
        player: localPlayerPosition(pair.curr),
        aim: init.getAim?.() ?? null,
        weaponArchetypeId: selectedWeaponArchetypeId(pair.curr),
        weaponRegistry
      });
      updateZoneOverlay(zoneOverlay, pair, alpha);
      updateVibeJamPortalMeshes(
        portalDescriptors,
        portalMeshes,
        scene,
        pair.nowMs,
        prefersReducedMotion
      );
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
      if (companionEntry !== null) disposeEntityMesh(companionEntry);
      scene.remove(crosshair);
      disposeArcPreview(arcPreview);
      scene.remove(zoneOverlay.mesh);
      for (const entry of enemyMeshes.values()) disposeEntityMesh(entry);
      enemyMeshes.clear();
      for (const entry of otherPlayerMeshes.values()) disposeEntityMesh(entry);
      otherPlayerMeshes.clear();
      for (const entry of companionMeshes.values()) disposeEntityMesh(entry);
      companionMeshes.clear();
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
      for (const entry of portalMeshes.values()) disposeVibeJamPortalMesh(scene, entry);
      portalMeshes.clear();
      arenaGeometry.dispose();
      arenaMaterial.dispose();
      arenaBackground.dispose();
      disposeCrosshair(crosshair);
      arenaBorder.geometry.dispose();
      (arenaBorder.material as THREE.Material).dispose();
      zoneOverlay.dispose();
      impactEffects.clear();
      landingTelegraphs.dispose();
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

function createCompanionEntry(
  selectedPetId: string | null,
  spriteTextures: TextureMap
): CompanionEntry | null {
  if (selectedPetId === null) {
    return null;
  }
  requirePetArchetype(selectedPetId);
  const entry = createSpriteMesh(
    requireVisualSpec(PET_VISUALS, selectedPetId, 'pet'),
    requireSpriteTexture(spriteTextures, selectedPetId, 'pet'),
    COMPANION_Z
  );
  entry.mesh.visible = false;
  return {
    ...entry,
    x: 0,
    y: 0,
    initialized: false,
    lastUpdatedAtMs: null
  };
}

function requirePetArchetype(petId: string): void {
  if (PET_ARCHETYPES[petId] !== undefined) {
    return;
  }
  throw new Error(`pet archetype missing for id "${petId}"`);
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

function createCompanionHpBar(entityHeight: number): THREE.Group {
  const group = createHpBarGroup(entityHeight, {
    trackName: COMPANION_HP_TRACK_NAME,
    fillName: COMPANION_HP_FILL_NAME
  });
  const rescueFill = createHpBarMesh(
    COMPANION_HP_RESCUE_FILL_NAME,
    COMPANION_HP_RESCUE_FILL_COLOR,
    0.94
  );
  rescueFill.position.z = 0.02;
  rescueFill.visible = false;
  group.add(rescueFill);
  return group;
}

function createPlayerHpBar(entityHeight: number): THREE.Group {
  return createHpBarGroup(entityHeight, {
    trackName: PLAYER_HP_TRACK_NAME,
    fillName: PLAYER_HP_FILL_NAME
  });
}

function createHpBarGroup(
  entityHeight: number,
  names: Readonly<{
    trackName: string;
    fillName: string;
  }>
): THREE.Group {
  const group = new THREE.Group();
  group.position.y = entityHeight / 2 + CHARACTER_HP_BAR_OFFSET_WU;
  group.position.z = 0.07;
  group.add(createHpBarMesh(names.trackName, CHARACTER_HP_TRACK_COLOR, 0.82));
  const fill = createHpBarMesh(names.fillName, CHARACTER_HP_FILL_COLOR, 0.95);
  fill.position.z = 0.01;
  group.add(fill);
  return group;
}

function createHpBarMesh(name: string, color: number, opacity: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(CHARACTER_HP_BAR_WIDTH_WU, CHARACTER_HP_BAR_HEIGHT_WU),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false
    })
  );
  mesh.name = name;
  return mesh;
}

function createCompanionWarningMarker(entityHeight: number): THREE.Mesh {
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.14, 0.2, 3),
    new THREE.MeshBasicMaterial({
      color: COMPANION_WARNING_COLOR,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    })
  );
  marker.name = COMPANION_WARNING_MARKER_NAME;
  marker.position.y = entityHeight / 2 + 0.48;
  marker.position.z = 0.08;
  marker.visible = false;
  return marker;
}

function createCompanionGhostAura(worldSize: SpriteVisualSpec['worldSize']): THREE.Mesh {
  const aura = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.62, 48),
    new THREE.MeshBasicMaterial({
      color: COMPANION_GHOST_COLOR,
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    })
  );
  aura.name = COMPANION_GHOST_AURA_NAME;
  aura.position.z = -0.01;
  const baseScale = Math.max(worldSize.width, worldSize.height);
  aura.scale.set(baseScale, baseScale, 1);
  aura.userData['baseScale'] = baseScale;
  aura.visible = false;
  return aura;
}

function createCompanionRescueRing(worldSize: SpriteVisualSpec['worldSize']): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.52, 0.6, 48),
    new THREE.MeshBasicMaterial({
      color: COMPANION_RESCUE_COLOR,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    })
  );
  ring.name = COMPANION_RESCUE_RING_NAME;
  ring.position.z = 0.075;
  const baseScale = Math.max(worldSize.width, worldSize.height);
  ring.scale.set(baseScale, baseScale, 1);
  ring.userData['baseScale'] = baseScale;
  ring.visible = false;
  return ring;
}

function applyPlayerPortalTravelPresentation(
  entry: EntityMeshEntry,
  pair: SnapshotPair,
  portals: ReadonlyArray<VibeJamPortalDescriptor>
): void {
  const progress = resolvePortalTravelProgress(pair, portals);
  if (progress === null) {
    if (entry.material instanceof THREE.MeshBasicMaterial) {
      entry.material.opacity = 1;
    }
    return;
  }

  const eased = easeOutCubic(progress);
  const scale = Math.max(PORTAL_TRAVEL_MIN_PLAYER_SCALE, 1 - 0.92 * eased);
  entry.mesh.scale.set(entry.mesh.scale.x * scale, entry.mesh.scale.y * scale, 1);
  if (entry.material instanceof THREE.MeshBasicMaterial) {
    entry.material.opacity = Math.max(0.2, 1 - 0.8 * eased);
  }
}

function resolvePortalTravelProgress(
  pair: SnapshotPair,
  portals: ReadonlyArray<VibeJamPortalDescriptor>
): number | null {
  const simTimeMs = pair.curr?.simTimeMs ?? null;
  if (simTimeMs === null) return null;

  let progress: number | null = null;
  for (const portal of portals) {
    if (portal.travelStartedAtSimMs === undefined || portal.travelDurationMs === undefined) {
      continue;
    }
    const durationMs = Math.max(1, portal.travelDurationMs);
    const nextProgress = Math.max(
      0,
      Math.min(1, (simTimeMs - portal.travelStartedAtSimMs) / durationMs)
    );
    progress = Math.max(progress ?? 0, nextProgress);
  }
  return progress;
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

function applyOtherPlayerPresentation(
  mesh: THREE.Mesh,
  entity: PlayerSnapshot,
  nowMs: number,
  hitImpulse: HitImpulseEffect | undefined
): void {
  applyPlayerPresentation(mesh, nowMs, { dx: 0, dy: 0, strength: 0 });
  applyHitFlash(mesh, hitImpulse, nowMs);
  applyPlayerHpBar(mesh, entity);
  applyStatusMarker(mesh, entity.statusEffects ?? [], nowMs);
  applyPlayerGhostPresentation(mesh, entity, nowMs);
}

function applyCompanionPresentation(
  mesh: THREE.Mesh,
  entity: CompanionSnapshot,
  session: RendererSessionConfig,
  nowMs: number,
  hitImpulse: HitImpulseEffect | undefined
): void {
  applySlimePresentation(mesh, nowMs, entity.id, SLIME_BREATH_AMPLITUDE, hitImpulse);
  const flip = companionFlipSign(entity, nowMs);
  mesh.scale.x = Math.abs(mesh.scale.x) * flip;

  const material = mesh.material;
  if (!Array.isArray(material) && material instanceof THREE.MeshBasicMaterial) {
    material.opacity =
      entity.state === 'ghost' ? 0.5 + 0.1 * shimmer01(nowMs, entity.id, 260) : 1;
  }

  applyCompanionHpBar(mesh, entity, companionConfigForSnapshot(session, entity), flip);
  applyCompanionWarningMarker(mesh, entity, nowMs);
  applyCompanionGhostAura(mesh, entity, nowMs);
  applyCompanionRescueRing(mesh, entity, nowMs);
}

function companionFlipSign(entity: CompanionSnapshot, nowMs: number): number {
  if (entity.mode === 'rescue') {
    return Math.floor(nowMs / 90) % 2 === 0 ? 1 : -1;
  }
  if (entity.mode === 'alert') {
    return Math.floor(nowMs / 140) % 2 === 0 ? 1 : -1;
  }
  if (entity.mode === 'rest') {
    return Math.sin(nowMs / 820 + entity.id * 1.7) > 0.72 ? -1 : 1;
  }
  if (entity.state === 'ghost') {
    return Math.sin(nowMs / 540 + entity.id) >= 0 ? 1 : -1;
  }
  return 1;
}

function applyCompanionHpBar(
  mesh: THREE.Mesh,
  entity: CompanionSnapshot,
  companionConfig: NonNullable<SessionDefinition['players'][number]['companion']> | null,
  flip: number
): void {
  const track = findChildMesh(mesh, COMPANION_HP_TRACK_NAME);
  const fill = findChildMesh(mesh, COMPANION_HP_FILL_NAME);
  const rescueFill = findChildMesh(mesh, COMPANION_HP_RESCUE_FILL_NAME);
  if (track === null || fill === null || rescueFill === null) return;
  if (track.parent !== null) {
    track.parent.scale.x = flip;
  }
  const visible = entity.maxHp > 0;
  track.visible = visible;
  fill.visible = visible;
  const rescueProgress = entity.rescueProgress;
  rescueFill.visible = visible && companionConfig !== null && rescueProgress !== null;
  if (!visible) return;
  const ratio = clamp01(entity.hp / entity.maxHp);
  fill.scale.x = ratio;
  fill.position.x = (-CHARACTER_HP_BAR_WIDTH_WU * (1 - ratio)) / 2;
  if (companionConfig !== null && rescueProgress !== null) {
    const reviveHp = Math.max(
      1,
      Math.ceil(entity.maxHp * companionConfig.rescue.reviveHpFraction)
    );
    const targetRatio = clamp01(reviveHp / entity.maxHp);
    const progressRatio = ratio + (targetRatio - ratio) * rescueProgress;
    rescueFill.scale.x = clamp01(progressRatio);
    rescueFill.position.x = (-CHARACTER_HP_BAR_WIDTH_WU * (1 - rescueFill.scale.x)) / 2;
  }
  const fillMaterial = fill.material;
  if (!Array.isArray(fillMaterial) && fillMaterial instanceof THREE.MeshBasicMaterial) {
    fillMaterial.color.setHex(
      entity.state === 'ghost' ? COMPANION_HP_GHOST_FILL_COLOR : CHARACTER_HP_FILL_COLOR
    );
    fillMaterial.opacity = entity.state === 'ghost' ? 0.48 : 0.95;
  }
}

function companionConfigForSnapshot(
  session: RendererSessionConfig,
  entity: CompanionSnapshot
): NonNullable<SessionDefinition['players'][number]['companion']> | null {
  return (
    session.players.find((player) => player.id === entity.ownerPlayerId)?.companion ?? null
  );
}

function applyPlayerHpBar(mesh: THREE.Mesh, player: PlayerSnapshot): void {
  const track = findChildMesh(mesh, PLAYER_HP_TRACK_NAME);
  const fill = findChildMesh(mesh, PLAYER_HP_FILL_NAME);
  if (track === null || fill === null) return;
  const visible = player.maxHp > 0;
  track.visible = visible;
  fill.visible = visible;
  if (!visible) return;
  const ratio = clamp01(player.hp / player.maxHp);
  fill.scale.x = ratio;
  fill.position.x = (-CHARACTER_HP_BAR_WIDTH_WU * (1 - ratio)) / 2;
}

function applyPlayerGhostPresentation(
  mesh: THREE.Mesh,
  player: PlayerSnapshot,
  nowMs: number
): void {
  const material = mesh.material;
  if (Array.isArray(material) || !(material instanceof THREE.MeshBasicMaterial)) return;
  material.opacity =
    player.state === 'ghost' ? 0.48 + 0.1 * shimmer01(nowMs, player.id, 280) : 1;
}

function applyHitFlash(
  mesh: THREE.Mesh,
  hitImpulse: HitImpulseEffect | undefined,
  nowMs: number
): void {
  const material = mesh.material;
  if (Array.isArray(material) || !(material instanceof THREE.MeshBasicMaterial)) return;
  const flash = 1 + 0.55 * computeHitResponseT(hitImpulse, nowMs);
  material.color.setRGB(flash, flash, flash);
}

function applyCompanionWarningMarker(
  mesh: THREE.Mesh,
  entity: CompanionSnapshot,
  nowMs: number
): void {
  const marker = findChildMesh(mesh, COMPANION_WARNING_MARKER_NAME);
  if (marker === null) return;
  marker.visible = entity.mode === 'alert';
  if (!marker.visible) return;
  const pulse = 0.9 + 0.22 * shimmer01(nowMs, entity.id, 80);
  marker.scale.set(pulse, pulse, 1);
  marker.rotation.z = nowMs / 120;
}

function applyCompanionGhostAura(mesh: THREE.Mesh, entity: CompanionSnapshot, nowMs: number): void {
  const aura = findChildMesh(mesh, COMPANION_GHOST_AURA_NAME);
  if (aura === null) return;
  aura.visible = entity.state === 'ghost';
  if (!aura.visible) return;
  const pulse = 0.94 + 0.12 * shimmer01(nowMs, entity.id, 420);
  const baseScale = companionChildBaseScale(aura);
  aura.scale.x = baseScale * pulse;
  aura.scale.y = baseScale * pulse;
  const material = aura.material;
  if (!Array.isArray(material) && material instanceof THREE.MeshBasicMaterial) {
    material.opacity = 0.22 + 0.16 * shimmer01(nowMs, entity.id, 300);
  }
}

function applyCompanionRescueRing(
  mesh: THREE.Mesh,
  entity: CompanionSnapshot,
  nowMs: number
): void {
  const ring = findChildMesh(mesh, COMPANION_RESCUE_RING_NAME);
  if (ring === null) return;
  ring.visible = entity.mode === 'rescue';
  if (!ring.visible) return;
  const progress = entity.rescueProgress ?? 0;
  const pulse = 0.86 + progress * 0.28 + 0.08 * shimmer01(nowMs, entity.id, 120);
  const baseScale = companionChildBaseScale(ring);
  ring.scale.x = baseScale * pulse;
  ring.scale.y = baseScale * pulse;
  ring.rotation.z = -nowMs / 150;
}

function companionChildBaseScale(mesh: THREE.Mesh): number {
  const raw = mesh.userData['baseScale'];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 1;
}

function findChildMesh(root: THREE.Object3D, name: string): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  root.traverse((child) => {
    if (found !== null) return;
    if (child instanceof THREE.Mesh && child.name === name) {
      found = child;
    }
  });
  return found;
}

function shimmer01(nowMs: number, entityId: number, periodMs: number): number {
  return 0.5 + 0.5 * Math.sin((nowMs / periodMs) * Math.PI * 2 + entityId);
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
  kind: 'player' | 'enemy' | 'boss' | 'projectile' | 'drop' | 'pet'
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
  kind: 'player' | 'enemy' | 'boss' | 'projectile' | 'drop' | 'pet'
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
  visibleArea: Pick<VisibleArea, 'width' | 'height'>,
  backingWidthPx: number,
  backingHeightPx: number
): CharacterSnapGrid {
  return {
    stepX: visibleArea.width / backingWidthPx,
    stepY: visibleArea.height / backingHeightPx
  };
}

function readRendererViewport(windowTarget: RendererWindowTarget): Readonly<{
  width: number;
  height: number;
}> {
  return {
    width: windowTarget.innerWidth,
    height: windowTarget.innerHeight
  };
}

function applyCameraVisibleArea(
  camera: THREE.OrthographicCamera,
  visibleArea: VisibleArea
): void {
  camera.left = -visibleArea.width / 2;
  camera.right = visibleArea.width / 2;
  camera.top = visibleArea.height / 2;
  camera.bottom = -visibleArea.height / 2;
  camera.position.x = visibleArea.center.x;
  camera.position.y = visibleArea.center.y;
  camera.updateProjectionMatrix();
}

function parseCssPixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function prefersReducedMotionFromWindow(windowTarget: RendererWindowTarget): boolean {
  return windowTarget.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function computeAlpha(pair: SnapshotPair): number {
  const { prev, curr } = pair;
  if (!prev || !curr) return 1;
  const elapsedMs = pair.nowMs - pair.currReceivedAtMs;
  const renderSimTimeMs = curr.simTimeMs + elapsedMs - SNAPSHOT_INTERVAL_MS;
  const span = curr.simTimeMs - prev.simTimeMs;
  if (span <= 0) return 1;
  const raw = (renderSimTimeMs - prev.simTimeMs) / span;
  return clamp01(raw);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function disposeArcPreview(mesh: THREE.Mesh): void {
  mesh.removeFromParent();
  disposeObjectTree(mesh);
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
  if (!prev || !prevPlayer) {
    mesh.visible = true;
    setSnappedMeshPosition(mesh, player.x, player.y, 0, snapGrid);
    applyPlayerPresentation(mesh, pair.nowMs, { dx: 0, dy: 0, strength: 0 });
    applyPlayerHpBar(mesh, player);
    applyStatusMarker(mesh, player.statusEffects ?? [], pair.nowMs);
    applyPlayerGhostPresentation(mesh, player, pair.nowMs);
    return;
  }
  const x = prevPlayer.x + (player.x - prevPlayer.x) * alpha;
  const y = prevPlayer.y + (player.y - prevPlayer.y) * alpha;
  mesh.visible = true;
  setSnappedMeshPosition(mesh, x, y, 0, snapGrid);
  applyPlayerPresentation(
    mesh,
    pair.nowMs,
    playerPresentationMotion(prevPlayer, player, prev, curr)
  );
  applyPlayerHpBar(mesh, player);
  applyStatusMarker(mesh, player.statusEffects ?? [], pair.nowMs);
  applyPlayerGhostPresentation(mesh, player, pair.nowMs);
}

type PlayerPresentationMotion = Readonly<{
  dx: number;
  dy: number;
  strength: number;
}>;

function playerPresentationMotion(
  prevPlayer: PlayerSnapshot,
  player: PlayerSnapshot,
  prev: Snapshot,
  curr: Snapshot
): PlayerPresentationMotion {
  const dx = player.x - prevPlayer.x;
  const dy = player.y - prevPlayer.y;
  const distance = Math.hypot(dx, dy);
  const spanSeconds = Math.max(0, (curr.simTimeMs - prev.simTimeMs) / 1000);
  if (distance === 0 || spanSeconds === 0) {
    return { dx: 0, dy: 0, strength: 0 };
  }
  const speed = distance / spanSeconds;
  return {
    dx: dx / distance,
    dy: dy / distance,
    strength: clamp01(speed / PLAYER_PRESENTATION_MAX_SPEED)
  };
}

function applyPlayerPresentation(
  mesh: THREE.Mesh,
  nowMs: number,
  motion: PlayerPresentationMotion
): void {
  const breath = Math.sin((nowMs / 1000) * PLAYER_BREATH_HZ * Math.PI * 2);
  const stride = Math.abs(Math.sin(nowMs / 95));
  const move = motion.strength * stride;
  mesh.scale.set(
    1 + PLAYER_BREATH_AMPLITUDE * breath + PLAYER_MOVE_STRETCH_AMPLITUDE * move,
    1 -
      PLAYER_BREATH_AMPLITUDE * PLAYER_BREATH_VERTICAL_RATIO * breath -
      PLAYER_MOVE_STRETCH_AMPLITUDE * 0.6 * move,
    1
  );
  mesh.rotation.z = -motion.dx * PLAYER_MOVE_LEAN_RADIANS * motion.strength;
  mesh.position.y += PLAYER_MOVE_BOB_AMPLITUDE_WU * move;
}

function updateCompanion(
  entry: CompanionEntry | null,
  pair: SnapshotPair,
  alpha: number,
  player: PlayerSpawn,
  snapGrid: CharacterSnapGrid | null,
  hiddenByRuntimeCompanion: boolean
): void {
  if (entry === null) {
    return;
  }
  if (hiddenByRuntimeCompanion) {
    entry.mesh.visible = false;
    entry.lastUpdatedAtMs = pair.nowMs;
    return;
  }
  const playerPosition = findInterpolatedPlayerPosition(pair, alpha);
  if (playerPosition === null) {
    entry.mesh.visible = false;
    entry.lastUpdatedAtMs = pair.nowMs;
    return;
  }

  if (!entry.initialized) {
    entry.x = playerPosition.x + player.radius * COMPANION_SPAWN_OFFSET_RADII;
    entry.y = playerPosition.y;
    entry.initialized = true;
  } else {
    const elapsedSeconds =
      entry.lastUpdatedAtMs === null
        ? 0
        : Math.max(0, (pair.nowMs - entry.lastUpdatedAtMs) / 1000);
    moveCompanionTowardPlayer(entry, playerPosition, player, elapsedSeconds);
  }
  entry.lastUpdatedAtMs = pair.nowMs;
  entry.mesh.visible = true;
  setSnappedMeshPosition(entry.mesh, entry.x, entry.y, entry.mesh.position.z, snapGrid);
  applySlimePresentation(
    entry.mesh,
    pair.nowMs,
    COMPANION_BREATH_ENTITY_ID,
    SLIME_BREATH_AMPLITUDE,
    undefined
  );
}

function findInterpolatedPlayerPosition(
  pair: SnapshotPair,
  alpha: number
): Readonly<{ x: number; y: number }> | null {
  const player = findPlayerSnapshot(pair.curr);
  if (player === null) {
    return null;
  }
  const prevPlayer = findPlayerSnapshot(pair.prev);
  if (prevPlayer === null) {
    return { x: player.x, y: player.y };
  }
  return {
    x: prevPlayer.x + (player.x - prevPlayer.x) * alpha,
    y: prevPlayer.y + (player.y - prevPlayer.y) * alpha
  };
}

function findPlayerSnapshot(snapshot: Snapshot | null): PlayerSnapshot | null {
  return (
    snapshot?.entities.find(
      (entity): entity is PlayerSnapshot => entity.kind === 'player'
    ) ?? null
  );
}

function moveCompanionTowardPlayer(
  entry: CompanionEntry,
  playerPosition: Readonly<{ x: number; y: number }>,
  player: PlayerSpawn,
  elapsedSeconds: number
): void {
  if (elapsedSeconds <= 0) {
    return;
  }
  const dx = playerPosition.x - entry.x;
  const dy = playerPosition.y - entry.y;
  const distance = Math.hypot(dx, dy);
  const followDistance = player.radius * COMPANION_FOLLOW_DISTANCE_RADII;
  if (distance <= followDistance || distance <= 0) {
    return;
  }
  const step = Math.min(distance - followDistance, player.maxSpeed * elapsedSeconds);
  if (step <= 0) {
    return;
  }
  entry.x += (dx / distance) * step;
  entry.y += (dy / distance) * step;
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
      material.opacity = slimeDropletOpacity(droplet.opacity);
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
    opacity: slimeDropletOpacity(droplet.opacity),
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = SLIME_STAIN_Z;
  scene.add(mesh);
  const entry: EntityMeshEntry = { mesh, geometry, material };
  table.set(droplet.id, entry);
  return entry;
}

function slimeDropletOpacity(opacity: number): number {
  return opacity * SLIME_DROPLET_BASE_OPACITY;
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

function localPlayerPosition(snapshot: Snapshot | null): Readonly<{ x: number; y: number }> | null {
  const player = snapshot?.entities.find(
    (entity): entity is PlayerSnapshot => entity.kind === 'player'
  );
  return player === undefined ? null : { x: player.x, y: player.y };
}

function selectedWeaponArchetypeId(snapshot: Snapshot | null): string | null {
  if (snapshot === null) {
    return null;
  }
  const player = findPlayerSnapshot(snapshot);
  const weaponHud = player?.weaponHud ?? null;
  if (weaponHud === null || weaponHud.selectedIndex === null) return null;
  const selected = weaponHud.weapons.find((weapon) => weapon.index === weaponHud.selectedIndex);
  return selected?.weaponArchetypeId ?? null;
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
      uFeather: { value: ZONE_FEATHER_WU },
      uOpacity: { value: ZONE_OVERLAY_OPACITY }
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
      uniform float uOpacity;

      float sdRoundedBox(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + vec2(r);
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
      }

      void main() {
        vec2 inner = max(uHalfSize - vec2(uMargin), vec2(0.001));
        float r = min(uCornerRadius, min(inner.x, inner.y));
        float d = sdRoundedBox(vWorldXY, inner, r);
        float alpha = clamp(smoothstep(0.0, uFeather, d), 0.0, 1.0);
        gl_FragColor = vec4(0.0, 0.0, 0.0, alpha * uOpacity);
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

function createNoopDebugHud(): DebugHud {
  return {
    update(): void {},
    dispose(): void {}
  };
}
