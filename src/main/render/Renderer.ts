import * as THREE from 'three';

import { ENEMY_ARCHETYPES, type EnemyArchetype } from '../../shared/content/enemies';
import { WEAPON_ARCHETYPES, type WeaponArchetype } from '../../shared/content/weapons';
import type { ArenaConfig, PlayerSpawn } from '../../shared/session';
import type {
  EnemySnapshot,
  EntitySnapshot,
  ProjectileSnapshot,
  Snapshot
} from '../../shared/snapshot';
import { SNAPSHOT_INTERVAL_MS } from '../../shared/timing';
import type { SnapshotPair } from '../sim/SimWorkerHost';

import { fitCanvasToViewport } from './fitToViewport';

export type AimAccessor = () => { x: number; y: number } | null;

export type RendererInit = Readonly<{
  canvas: HTMLCanvasElement;
  pixelRatio: number;
  arena: ArenaConfig;
  player: Pick<PlayerSpawn, 'radius'>;
  getSnapshotPair: () => SnapshotPair;
  getAim?: AimAccessor;
  enemyRegistry?: Readonly<Record<string, EnemyArchetype>>;
  weaponRegistry?: Readonly<Record<string, WeaponArchetype>>;
}>;

export type Renderer = Readonly<{
  render(): void;
  fitToWindow(): void;
  dispose(): void;
}>;

const ARENA_FLOOR_COLOR = 0x1b1f29;
const ARENA_BORDER_COLOR = 0x2a3142;
const PLAYER_COLOR = 0x9ad6ff;
const CROSSHAIR_COLOR = 0xffe066;
const CROSSHAIR_SIZE_WU = 0.6;
const CROSSHAIR_THICKNESS_WU = 0.05;
const SCENE_BG = 0x05060a;

const ENEMY_Z = 0;
const PROJECTILE_Z = 0.05;
const ZONE_OVERLAY_Z = 0.2;
const ZONE_CORNER_RADIUS_FACTOR = 0.25;
const ZONE_FEATHER_WU = 1.5;

export function createRenderer(init: RendererInit): Renderer {
  const enemyRegistry = init.enemyRegistry ?? ENEMY_ARCHETYPES;
  const weaponRegistry = init.weaponRegistry ?? WEAPON_ARCHETYPES;

  const renderer = new THREE.WebGLRenderer({ canvas: init.canvas, antialias: true });
  renderer.setPixelRatio(init.pixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BG);

  const halfW = init.arena.width / 2;
  const halfH = init.arena.height / 2;

  const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 10);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  const arenaGeometry = new THREE.PlaneGeometry(init.arena.width, init.arena.height);
  const arenaMaterial = new THREE.MeshBasicMaterial({ color: ARENA_FLOOR_COLOR });
  const arenaMesh = new THREE.Mesh(arenaGeometry, arenaMaterial);
  arenaMesh.position.z = -1;
  scene.add(arenaMesh);

  const arenaBorder = new THREE.LineSegments(
    new THREE.EdgesGeometry(arenaGeometry),
    new THREE.LineBasicMaterial({ color: ARENA_BORDER_COLOR })
  );
  arenaBorder.position.z = -0.5;
  scene.add(arenaBorder);

  const playerGeometry = new THREE.CircleGeometry(init.player.radius, 32);
  const playerMaterial = new THREE.MeshBasicMaterial({ color: PLAYER_COLOR });
  const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
  playerMesh.position.z = 0;
  playerMesh.visible = false;
  scene.add(playerMesh);

  const crosshair = createCrosshair();
  crosshair.visible = false;
  scene.add(crosshair);

  const zoneOverlay = createZoneOverlay(init.arena);
  scene.add(zoneOverlay.mesh);

  const debugHud = createDebugHud();

  type EntityMesh = { mesh: THREE.Mesh; geometry: THREE.BufferGeometry; material: THREE.Material };
  const enemyMeshes = new Map<number, EntityMesh>();
  const projectileMeshes = new Map<number, EntityMesh>();

  function fitToWindow(): void {
    const fit = fitCanvasToViewport({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      arenaAspect: init.arena.width / init.arena.height
    });
    if (fit.width <= 0 || fit.height <= 0) return;
    init.canvas.style.width = `${fit.width}px`;
    init.canvas.style.height = `${fit.height}px`;
    renderer.setSize(fit.width, fit.height, false);
  }

  fitToWindow();

  function disposeEntityMesh(entry: EntityMesh): void {
    scene.remove(entry.mesh);
    entry.geometry.dispose();
    entry.material.dispose();
  }

  function ensureEnemyMesh(snap: EnemySnapshot): EntityMesh {
    const existing = enemyMeshes.get(snap.id);
    if (existing !== undefined) return existing;
    const archetype = enemyRegistry[snap.archetypeId];
    const radius = archetype?.radius ?? 0.5;
    const color = archetype?.color ?? 0xffffff;
    const geometry = new THREE.CircleGeometry(radius, 24);
    const material = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = ENEMY_Z;
    scene.add(mesh);
    const entry: EntityMesh = { mesh, geometry, material };
    enemyMeshes.set(snap.id, entry);
    return entry;
  }

  function ensureProjectileMesh(snap: ProjectileSnapshot): EntityMesh {
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
    const entry: EntityMesh = { mesh, geometry, material };
    projectileMeshes.set(snap.id, entry);
    return entry;
  }

  return {
    render(): void {
      const pair = init.getSnapshotPair();
      const alpha = computeAlpha(pair);
      updatePlayer(playerMesh, pair, alpha);
      updateEntities(
        pair,
        alpha,
        (e): e is EnemySnapshot => e.kind === 'enemy',
        enemyMeshes,
        ensureEnemyMesh,
        disposeEntityMesh
      );
      updateEntities(
        pair,
        alpha,
        (e): e is ProjectileSnapshot => e.kind === 'projectile',
        projectileMeshes,
        ensureProjectileMesh,
        disposeEntityMesh
      );
      updateCrosshair(crosshair, init.getAim);
      updateZoneOverlay(zoneOverlay, pair, alpha);
      debugHud.update(pair.curr);
      renderer.render(scene, camera);
    },
    fitToWindow,
    dispose(): void {
      scene.remove(arenaMesh);
      scene.remove(arenaBorder);
      scene.remove(playerMesh);
      scene.remove(crosshair);
      scene.remove(zoneOverlay.mesh);
      for (const entry of enemyMeshes.values()) disposeEntityMesh(entry);
      enemyMeshes.clear();
      for (const entry of projectileMeshes.values()) disposeEntityMesh(entry);
      projectileMeshes.clear();
      arenaGeometry.dispose();
      arenaMaterial.dispose();
      playerGeometry.dispose();
      playerMaterial.dispose();
      disposeCrosshair(crosshair);
      arenaBorder.geometry.dispose();
      (arenaBorder.material as THREE.Material).dispose();
      zoneOverlay.dispose();
      debugHud.dispose();
      renderer.dispose();
    }
  };
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

function updatePlayer(mesh: THREE.Mesh, pair: SnapshotPair, alpha: number): void {
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
    mesh.position.set(player.x, player.y, 0);
    return;
  }
  const x = prevPlayer.x + (player.x - prevPlayer.x) * alpha;
  const y = prevPlayer.y + (player.y - prevPlayer.y) * alpha;
  mesh.visible = true;
  mesh.position.set(x, y, 0);
}

type EntityMeshEntry = { mesh: THREE.Mesh; geometry: THREE.BufferGeometry; material: THREE.Material };

function updateEntities<S extends EntitySnapshot>(
  pair: SnapshotPair,
  alpha: number,
  matches: (e: EntitySnapshot) => e is S,
  table: Map<number, EntityMeshEntry>,
  ensure: (snap: S) => EntityMeshEntry,
  dispose: (entry: EntityMeshEntry) => void
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
        entry.mesh.position.set(entity.x, entity.y, entry.mesh.position.z);
      } else {
        const x = prevSnap.x + (entity.x - prevSnap.x) * alpha;
        const y = prevSnap.y + (entity.y - prevSnap.y) * alpha;
        entry.mesh.position.set(x, y, entry.mesh.position.z);
      }
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

type DebugHud = Readonly<{
  update(snapshot: import('../../shared/snapshot').Snapshot | null): void;
  dispose(): void;
}>;

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
      div.textContent = lines.join('\n');
    },
    dispose(): void {
      div.remove();
    }
  };
}
