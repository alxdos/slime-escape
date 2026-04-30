import * as THREE from 'three';

import type {
  PublicArenaPlayerSnapshot,
  PublicArenaProjectileSnapshot,
  PublicArenaSnapshot
} from '../../shared/publicArenaProtocol';
import { WEAPON_ARCHETYPES } from '../../shared/content/weapons';
import {
  PUBLIC_ARENA_LOADOUT,
  PUBLIC_ARENA_PRESENTATION_CONFIG,
  type PublicArenaPresentationConfig
} from '../../shared/content/publicArena';
import { PUBLIC_ARENA_BOSS_WEAPON_ID } from '../../shared/publicArenaProgression';
import type { ArenaConfig } from '../../shared/session';
import { PX_PER_WU } from '../../shared/sprite/spriteScale';
import { createArcPreview, updateArcPreview } from '../render/arcPreview';
import { BOSS_VISUALS } from '../render/bossVisuals';
import {
  createCrosshair,
  disposeCrosshair,
  updateCrosshair,
  type AimAccessor
} from '../render/crosshair';
import { ENEMY_VISUALS } from '../render/enemyVisuals';
import { fitCanvasToViewport } from '../render/fitToViewport';
import { PROJECTILE_VISUALS } from '../render/projectileVisuals';
import {
  applyProjectilePresentation,
  createProjectileRadiusIndicator
} from '../render/projectilePresentation';
import { resolveRenderScale, type RenderScalePreset } from '../render/renderScale';
import type { SpriteVisualSpec } from '../render/SpriteVisualSpec';
import type { TextureMap } from '../render/spritePreload';
import {
  disposeVibeJamPortalMesh,
  updateVibeJamPortalMeshes,
  type VibeJamPortalMeshEntry
} from '../render/vibeJamPortalPresentation';
import {
  createVisibleAreaCamera,
  type VisibleArea,
  type VisibleAreaCamera
} from '../visibleArea';
import type { VibeJamPortalDescriptor } from '../VibeJamPortalController';

type PublicArenaRendererWindowTarget = Pick<
  Window,
  'innerWidth' | 'innerHeight' | 'devicePixelRatio'
>;

type PublicArenaRendererBackend = Readonly<{
  setPixelRatio(value: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}>;

type CreatePublicArenaRendererBackendFn = (init: Readonly<{
  canvas: HTMLCanvasElement;
}>) => PublicArenaRendererBackend;
type LoadBackgroundTextureFn = (
  url: string,
  onLoad?: (texture: THREE.Texture) => void
) => THREE.Texture;

export type PublicArenaRendererInit = Readonly<{
  canvas: HTMLCanvasElement;
  renderScalePreset: RenderScalePreset;
  arena: ArenaConfig;
  presentationConfig?: PublicArenaPresentationConfig;
  spriteTextures: TextureMap;
  getSnapshot(): PublicArenaSnapshot | null;
  getPortalDescriptors?: () => ReadonlyArray<VibeJamPortalDescriptor>;
  getAim?: AimAccessor;
  prefersReducedMotion?: boolean;
  visibleAreaCamera?: VisibleAreaCamera;
  windowTarget?: PublicArenaRendererWindowTarget;
  createRendererBackend?: CreatePublicArenaRendererBackendFn;
  loadBackgroundTexture?: LoadBackgroundTextureFn;
}>;

export type PublicArenaRenderer = Readonly<{
  render(): void;
  fitToWindow(): void;
  applyScalePolicy(preset: RenderScalePreset): void;
  dispose(): void;
}>;

type PlayerMeshEntry = Readonly<{
  group: THREE.Group;
  sprite: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  label: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  selfRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  isSelf: boolean;
  visualKey: string;
  level: number;
}>;

type ProjectileMeshEntry = Readonly<{
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  visualKey: string;
}>;

const SCENE_BG = 0x05060a;
const ARENA_BORDER_COLOR = 0x2a3142;
const ARENA_TINT_COLOR = 0x05060a;
const ARENA_TINT_OPACITY = 0.72;
const BACKGROUND_Z = -1;
const PLAYER_Z = 0;
const PROJECTILE_Z = 0.06;
const LABEL_Z = 0.18;
const SELF_RING_Z = -0.02;
const SELF_RING_COLOR = 0x5ee7ff;
const LEVEL_LABEL_WIDTH_WU = 0.78;
const LEVEL_LABEL_HEIGHT_WU = 0.3;
const LEVEL_LABEL_GAP_WU = 0.28;
const SELF_LEVEL_LABEL_GAP_WU = 0.16;
const SELF_HP_TRACK_NAME = 'public-arena-self-hp-track';
const SELF_HP_FILL_NAME = 'public-arena-self-hp-fill';
const SELF_HP_BAR_WIDTH_WU = 0.74;
const SELF_HP_BAR_HEIGHT_WU = 0.07;
const SELF_HP_BAR_OFFSET_WU = 0.22;
const SELF_HP_TRACK_COLOR = 0x161b22;
const SELF_HP_FILL_COLOR = 0x7ee7c8;
const SLIME_BREATH_HZ = 0.85;
const SLIME_BREATH_AMPLITUDE = 0.055;
const BOSS_BREATH_AMPLITUDE = 0.035;
const PROJECTILE_OPACITY = 0.95;

export function createPublicArenaRenderer(
  init: PublicArenaRendererInit
): PublicArenaRenderer {
  const windowTarget = init.windowTarget ?? window;
  const presentationConfig = init.presentationConfig ?? PUBLIC_ARENA_PRESENTATION_CONFIG;
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
      playerPosition: findSelfPosition(init.getSnapshot())
    });

  const camera = new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 10);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  applyCameraVisibleArea(camera, visibleAreaCamera.visibleArea());

  const arenaGeometry = new THREE.PlaneGeometry(init.arena.width, init.arena.height);
  const arenaBackground = createPublicArenaBackground({
    arena: init.arena,
    config: presentationConfig,
    loadTexture: init.loadBackgroundTexture ?? loadPublicArenaBackgroundTexture
  });
  scene.add(arenaBackground.mesh);

  const arenaBorder = new THREE.LineSegments(
    new THREE.EdgesGeometry(arenaGeometry),
    new THREE.LineBasicMaterial({ color: ARENA_BORDER_COLOR })
  );
  arenaBorder.position.z = -0.5;
  scene.add(arenaBorder);

  const playerMeshes = new Map<string, PlayerMeshEntry>();
  const projectileMeshes = new Map<string, ProjectileMeshEntry>();
  const portalMeshes = new Map<VibeJamPortalDescriptor['kind'], VibeJamPortalMeshEntry>();
  const crosshair = createCrosshair();
  crosshair.visible = false;
  scene.add(crosshair);
  const arcPreview = createArcPreview();
  scene.add(arcPreview);
  let currentRenderScalePreset = init.renderScalePreset;

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

  return {
    render(): void {
      const snapshot = init.getSnapshot();
      const nowMs = snapshot?.simTimeMs ?? 0;
      visibleAreaCamera.follow(findSelfPosition(snapshot), nowMs);
      applyCameraVisibleArea(camera, visibleAreaCamera.visibleArea());
      syncPlayers(snapshot, playerMeshes, init.spriteTextures, scene, nowMs);
      syncProjectiles(snapshot, projectileMeshes, init.spriteTextures, scene);
      updateVibeJamPortalMeshes(
        init.getPortalDescriptors?.() ?? [],
        portalMeshes,
        scene,
        nowMs,
        init.prefersReducedMotion === true
      );
      updateCrosshair(crosshair, init.getAim);
      updateArcPreview(arcPreview, {
        player: findSelfArcPreviewPlayer(snapshot),
        aim: init.getAim?.() ?? null,
        weaponArchetypeId: selectedPublicArenaWeaponId(snapshot),
        weaponRegistry: WEAPON_ARCHETYPES
      });
      renderer.render(scene, camera);
    },
    fitToWindow,
    applyScalePolicy,
    dispose(): void {
      for (const entry of playerMeshes.values()) {
        disposePlayerEntry(entry, scene);
      }
      playerMeshes.clear();
      for (const entry of projectileMeshes.values()) {
        disposeProjectileEntry(entry, scene);
      }
      projectileMeshes.clear();
      for (const entry of portalMeshes.values()) {
        disposeVibeJamPortalMesh(scene, entry);
      }
      portalMeshes.clear();
      scene.remove(arenaBackground.mesh);
      scene.remove(arenaBorder);
      scene.remove(crosshair);
      scene.remove(arcPreview);
      arenaGeometry.dispose();
      arenaBackground.dispose();
      arenaBorder.geometry.dispose();
      (arenaBorder.material as THREE.Material).dispose();
      disposeCrosshair(crosshair);
      disposeObjectTree(arcPreview);
      renderer.dispose();
    }
  };
}

type PublicArenaBackground = Readonly<{
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  dispose(): void;
}>;

function createPublicArenaBackground(init: Readonly<{
  arena: ArenaConfig;
  config: PublicArenaPresentationConfig;
  loadTexture: LoadBackgroundTextureFn;
}>): PublicArenaBackground {
  const background = init.config.backgrounds.find(
    (entry) => entry.id === init.config.activeBackgroundId
  );
  if (background === undefined) {
    throw new Error(
      `public arena background "${init.config.activeBackgroundId}" is missing from config`
    );
  }

  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: ARENA_TINT_COLOR,
    transparent: true,
    opacity: ARENA_TINT_OPACITY,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'public-arena-background';
  mesh.position.z = BACKGROUND_Z;
  mesh.userData['backgroundId'] = background.id;
  mesh.userData['imageUrl'] = background.imageUrl;
  mesh.scale.set(init.arena.width, init.arena.height, 1);

  const texture = init.loadTexture(background.imageUrl, (loaded) => {
    preparePublicArenaBackgroundTexture(loaded, init.arena);
  });
  preparePublicArenaBackgroundTexture(texture, init.arena);
  material.map = texture;
  material.color.set(0xffffff);
  material.needsUpdate = true;

  return {
    mesh,
    dispose(): void {
      texture.dispose();
      geometry.dispose();
      material.dispose();
    }
  };
}

function loadPublicArenaBackgroundTexture(
  url: string,
  onLoad?: (texture: THREE.Texture) => void
): THREE.Texture {
  return new THREE.TextureLoader().load(url, onLoad);
}

function preparePublicArenaBackgroundTexture(texture: THREE.Texture, arena: ArenaConfig): void {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  const sourceSize = readTextureSourceSize(texture);
  if (sourceSize === null) {
    return;
  }
  const tileWidthWu = sourceSize.width / PX_PER_WU;
  const tileHeightWu = sourceSize.height / PX_PER_WU;
  texture.repeat.set(arena.width / tileWidthWu, arena.height / tileHeightWu);
  texture.needsUpdate = true;
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

function syncPlayers(
  snapshot: PublicArenaSnapshot | null,
  entries: Map<string, PlayerMeshEntry>,
  textures: TextureMap,
  scene: THREE.Scene,
  nowMs: number
): void {
  const alive = new Set<string>();
  for (const player of snapshot?.players ?? []) {
    alive.add(player.id);
    const entry = ensurePlayerEntry(player, entries, textures, scene, snapshot?.selfId ?? null);
    entry.group.position.set(player.x, player.y, 0);
    entry.selfRing.visible = player.id === snapshot?.selfId;
    entry.group.visible = true;
    if (entry.isSelf) {
      applySelfHpBar(entry.group, player);
    }
    applyPlayerBreath(entry.sprite, player, nowMs);
  }
  for (const [id, entry] of entries) {
    if (alive.has(id)) continue;
    disposePlayerEntry(entry, scene);
    entries.delete(id);
  }
}

function ensurePlayerEntry(
  player: PublicArenaPlayerSnapshot,
  entries: Map<string, PlayerMeshEntry>,
  textures: TextureMap,
  scene: THREE.Scene,
  selfId: string | null
): PlayerMeshEntry {
  const visualKey = playerVisualKey(player);
  const existing = entries.get(player.id);
  const isSelf = player.id === selfId;
  if (
    existing !== undefined &&
    existing.visualKey === visualKey &&
    existing.level === player.level &&
    existing.isSelf === isSelf
  ) {
    return existing;
  }
  return replacePlayerEntry(player, entries, textures, scene, selfId);
}

function replacePlayerEntry(
  player: PublicArenaPlayerSnapshot,
  entries: Map<string, PlayerMeshEntry>,
  textures: TextureMap,
  scene: THREE.Scene,
  selfId: string | null
): PlayerMeshEntry {
  const previous = entries.get(player.id);
  if (previous !== undefined) {
    disposePlayerEntry(previous, scene);
  }

  const visual = playerVisualSpec(player);
  const isSelf = player.id === selfId;
  const texture = requireSpriteTexture(textures, visual.archetypeId, player.form.kind);
  const group = new THREE.Group();
  group.name = 'public-arena-player';
  group.userData['playerId'] = player.id;
  group.userData['formKind'] = player.form.kind;
  group.userData['archetypeId'] = player.form.archetypeId;
  group.userData['level'] = player.level;

  const sprite = createSpriteMesh(visual, texture, PLAYER_Z);
  sprite.name = 'public-arena-player-sprite';
  group.add(sprite);

  const selfRing = createSelfRing(visual);
  selfRing.visible = isSelf;
  group.add(selfRing);

  if (isSelf) {
    group.add(createSelfHpBar(visual.worldSize.height));
  }

  const label = createLevelLabel(player.level, visual.worldSize.height, isSelf);
  group.add(label);

  scene.add(group);
  const entry = {
    group,
    sprite,
    label,
    selfRing,
    isSelf,
    visualKey: playerVisualKey(player),
    level: player.level
  };
  entries.set(player.id, entry);
  return entry;
}

function syncProjectiles(
  snapshot: PublicArenaSnapshot | null,
  entries: Map<string, ProjectileMeshEntry>,
  textures: TextureMap,
  scene: THREE.Scene
): void {
  const alive = new Set<string>();
  for (const projectile of snapshot?.projectiles ?? []) {
    alive.add(projectile.id);
    const entry = ensureProjectileEntry(projectile, entries, textures, scene);
    entry.mesh.position.set(projectile.x, projectile.y, PROJECTILE_Z);
    applyProjectilePresentation(entry.mesh, projectile, WEAPON_ARCHETYPES);
  }
  for (const [id, entry] of entries) {
    if (alive.has(id)) continue;
    disposeProjectileEntry(entry, scene);
    entries.delete(id);
  }
}

function ensureProjectileEntry(
  projectile: PublicArenaProjectileSnapshot,
  entries: Map<string, ProjectileMeshEntry>,
  textures: TextureMap,
  scene: THREE.Scene
): ProjectileMeshEntry {
  const existing = entries.get(projectile.id);
  if (existing !== undefined && existing.visualKey === projectile.weaponArchetypeId) {
    return existing;
  }
  if (existing !== undefined) {
    disposeProjectileEntry(existing, scene);
  }
  const visual = requireVisualSpec(PROJECTILE_VISUALS, projectile.weaponArchetypeId, 'projectile');
  const texture = requireSpriteTexture(textures, projectile.weaponArchetypeId, 'projectile');
  const mesh = createSpriteMesh(visual, texture, PROJECTILE_Z);
  mesh.name = 'public-arena-projectile';
  mesh.userData['projectileId'] = projectile.id;
  mesh.userData['weaponArchetypeId'] = projectile.weaponArchetypeId;
  mesh.add(createProjectileRadiusIndicator());
  if (mesh.material instanceof THREE.MeshBasicMaterial) {
    mesh.material.opacity = PROJECTILE_OPACITY;
  }
  scene.add(mesh);
  const entry = { mesh, visualKey: projectile.weaponArchetypeId };
  entries.set(projectile.id, entry);
  return entry;
}

function playerVisualKey(player: PublicArenaPlayerSnapshot): string {
  return `${player.form.kind}:${player.form.archetypeId}`;
}

function playerVisualSpec(player: PublicArenaPlayerSnapshot): SpriteVisualSpec {
  switch (player.form.kind) {
    case 'slime':
      return requireVisualSpec(ENEMY_VISUALS, player.form.archetypeId, 'slime');
    case 'boss':
      return requireVisualSpec(BOSS_VISUALS, player.form.archetypeId, 'boss');
  }
}

function createSpriteMesh(
  visual: SpriteVisualSpec,
  texture: THREE.Texture,
  z: number
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(visual.worldSize.width, visual.worldSize.height),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false
    })
  );
  mesh.position.z = z;
  return mesh;
}

function createSelfRing(visual: SpriteVisualSpec): THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> {
  const radius = Math.max(visual.worldSize.width, visual.worldSize.height) * 0.36;
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + 0.07, 48),
    new THREE.MeshBasicMaterial({
      color: SELF_RING_COLOR,
      transparent: true,
      opacity: 0.86,
      depthWrite: false
    })
  );
  mesh.name = 'public-arena-self-ring';
  mesh.position.z = SELF_RING_Z;
  return mesh;
}

function createLevelLabel(
  level: number,
  visualHeight: number,
  isSelf: boolean
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const texture = createLevelLabelTexture(level);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: texture === null ? 0xfff38b : 0xffffff,
    transparent: true,
    opacity: texture === null ? 0.72 : 1,
    depthWrite: false,
    depthTest: false
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(LEVEL_LABEL_WIDTH_WU, LEVEL_LABEL_HEIGHT_WU),
    material
  );
  mesh.name = 'public-arena-level-label';
  mesh.position.set(0, levelLabelY(visualHeight, isSelf), LABEL_Z);
  mesh.renderOrder = 40;
  mesh.userData['level'] = level;
  return mesh;
}

function levelLabelY(visualHeight: number, isSelf: boolean): number {
  if (!isSelf) {
    return visualHeight / 2 + LEVEL_LABEL_GAP_WU;
  }
  return (
    visualHeight / 2 +
    SELF_HP_BAR_OFFSET_WU +
    SELF_HP_BAR_HEIGHT_WU / 2 +
    SELF_LEVEL_LABEL_GAP_WU +
    LEVEL_LABEL_HEIGHT_WU / 2
  );
}

function createSelfHpBar(visualHeight: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'public-arena-self-hp-bar';
  group.position.y = visualHeight / 2 + SELF_HP_BAR_OFFSET_WU;
  group.position.z = 0.07;
  group.add(createSelfHpBarMesh(SELF_HP_TRACK_NAME, SELF_HP_TRACK_COLOR, 0.82));
  const fill = createSelfHpBarMesh(SELF_HP_FILL_NAME, SELF_HP_FILL_COLOR, 0.95);
  fill.position.z = 0.01;
  group.add(fill);
  return group;
}

function createSelfHpBarMesh(name: string, color: number, opacity: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(SELF_HP_BAR_WIDTH_WU, SELF_HP_BAR_HEIGHT_WU),
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

function applySelfHpBar(group: THREE.Group, player: PublicArenaPlayerSnapshot): void {
  const track = findChildMesh(group, SELF_HP_TRACK_NAME);
  const fill = findChildMesh(group, SELF_HP_FILL_NAME);
  if (track === null || fill === null) return;
  const visible = player.maxHp > 0;
  track.visible = visible;
  fill.visible = visible;
  if (!visible) return;
  const ratio = clamp01(player.hp / player.maxHp);
  fill.scale.x = ratio;
  fill.position.x = (-SELF_HP_BAR_WIDTH_WU * (1 - ratio)) / 2;
}

function createLevelLabelTexture(level: number): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(5, 5, 5, 0.74)';
  ctx.strokeStyle = 'rgba(255, 243, 139, 0.95)';
  ctx.lineWidth = 6;
  roundedRect(ctx, 8, 8, canvas.width - 16, canvas.height - 16, 18);
  ctx.fill();
  ctx.stroke();
  ctx.font = '900 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(5, 5, 5, 0.95)';
  ctx.strokeText(`LV ${Math.max(1, Math.floor(level))}`, canvas.width / 2, canvas.height / 2 + 2);
  ctx.fillStyle = '#fff38b';
  ctx.fillText(`LV ${Math.max(1, Math.floor(level))}`, canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const right = x + width;
  const bottom = y + height;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(right - radius, y);
  ctx.quadraticCurveTo(right, y, right, y + radius);
  ctx.lineTo(right, bottom - radius);
  ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
  ctx.lineTo(x + radius, bottom);
  ctx.quadraticCurveTo(x, bottom, x, bottom - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function applyPlayerBreath(
  sprite: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>,
  player: PublicArenaPlayerSnapshot,
  nowMs: number
): void {
  const amplitude = player.form.kind === 'boss' ? BOSS_BREATH_AMPLITUDE : SLIME_BREATH_AMPLITUDE;
  const breath = Math.sin((nowMs / 1000) * SLIME_BREATH_HZ * Math.PI * 2 + player.id.length);
  sprite.scale.set(1 + amplitude * breath, 1 - amplitude * 0.7 * breath, 1);
}

function findSelfArcPreviewPlayer(
  snapshot: PublicArenaSnapshot | null
): Readonly<{ x: number; y: number }> | null {
  const player = snapshot?.players.find((candidate) => candidate.id === snapshot.selfId);
  return player === undefined ? null : { x: player.x, y: player.y };
}

function selectedPublicArenaWeaponId(snapshot: PublicArenaSnapshot | null): string | null {
  const player = snapshot?.players.find((candidate) => candidate.id === snapshot.selfId);
  if (player === undefined) {
    return null;
  }
  if (player.form.kind === 'boss') {
    return PUBLIC_ARENA_BOSS_WEAPON_ID;
  }
  return regularWeaponIdAtIndex(
    player.selectedWeaponIndex ?? defaultPublicArenaSelectedWeaponIndex()
  );
}

function defaultPublicArenaSelectedWeaponIndex(): number {
  const selectedIndex = PUBLIC_ARENA_LOADOUT.selectedIndex;
  if (selectedIndex === null) {
    throw new Error('Public Arena portal loadout must select a weapon for aim affordances.');
  }
  return selectedIndex;
}

function regularWeaponIdAtIndex(index: number): string {
  const weaponId = PUBLIC_ARENA_LOADOUT.weapons[index];
  if (weaponId === undefined) {
    throw new Error(`Public Arena snapshot has invalid selected weapon index ${index}.`);
  }
  return weaponId;
}

function findSelfPosition(snapshot: PublicArenaSnapshot | null): Readonly<{ x: number; y: number }> {
  const self = snapshot?.players.find((player) => player.id === snapshot.selfId);
  return self === undefined ? { x: 0, y: 0 } : { x: self.x, y: self.y };
}

function requireVisualSpec(
  visuals: Readonly<Record<string, SpriteVisualSpec>>,
  archetypeId: string,
  kind: string
): SpriteVisualSpec {
  const visual = visuals[archetypeId];
  if (visual !== undefined) {
    return visual;
  }
  throw new Error(`${kind} visual missing for archetype "${archetypeId}"`);
}

function requireSpriteTexture(textures: TextureMap, archetypeId: string, kind: string): THREE.Texture {
  const texture = textures[archetypeId];
  if (texture !== undefined) {
    return texture;
  }
  throw new Error(`${kind} texture missing for archetype "${archetypeId}"`);
}

function findChildMesh(root: THREE.Object3D, name: string): THREE.Mesh | null {
  const child = root.children.find(
    (entry): entry is THREE.Mesh => entry instanceof THREE.Mesh && entry.name === name
  );
  if (child !== undefined) {
    return child;
  }
  for (const entry of root.children) {
    const match = findChildMesh(entry, name);
    if (match !== null) return match;
  }
  return null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function disposePlayerEntry(entry: PlayerMeshEntry, scene: THREE.Scene): void {
  scene.remove(entry.group);
  entry.label.material.map?.dispose();
  disposeObjectTree(entry.group);
}

function disposeProjectileEntry(entry: ProjectileMeshEntry, scene: THREE.Scene): void {
  scene.remove(entry.mesh);
  disposeObjectTree(entry.mesh);
}

function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((child) => {
    const maybeMesh = child as Partial<
      Readonly<{ geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }>
    >;
    maybeMesh.geometry?.dispose();
    const material = maybeMesh.material;
    if (Array.isArray(material)) {
      for (const entry of material) {
        disposeMaterial(entry);
      }
    } else if (material !== undefined) {
      disposeMaterial(material);
    }
  });
}

function disposeMaterial(material: THREE.Material): void {
  material.dispose();
}

function createThreeRendererBackend(init: Readonly<{
  canvas: HTMLCanvasElement;
}>): PublicArenaRendererBackend {
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

function readRendererViewport(windowTarget: PublicArenaRendererWindowTarget): Readonly<{
  width: number;
  height: number;
}> {
  return {
    width: windowTarget.innerWidth,
    height: windowTarget.innerHeight
  };
}

function applyCameraVisibleArea(camera: THREE.OrthographicCamera, visibleArea: VisibleArea): void {
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
