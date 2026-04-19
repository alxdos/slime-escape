import * as THREE from 'three';

import type { ArenaConfig, PlayerSpawn } from '../../shared/session';
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

export function createRenderer(init: RendererInit): Renderer {
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

  return {
    render(): void {
      const pair = init.getSnapshotPair();
      updatePlayer(playerMesh, pair);
      updateCrosshair(crosshair, init.getAim);
      renderer.render(scene, camera);
    },
    fitToWindow,
    dispose(): void {
      scene.remove(arenaMesh);
      scene.remove(arenaBorder);
      scene.remove(playerMesh);
      scene.remove(crosshair);
      arenaGeometry.dispose();
      arenaMaterial.dispose();
      playerGeometry.dispose();
      playerMaterial.dispose();
      disposeCrosshair(crosshair);
      arenaBorder.geometry.dispose();
      (arenaBorder.material as THREE.Material).dispose();
      renderer.dispose();
    }
  };
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

function updatePlayer(mesh: THREE.Mesh, pair: SnapshotPair): void {
  const { prev, curr } = pair;
  if (!curr) {
    mesh.visible = false;
    return;
  }
  const currPlayer = findPlayer(curr.entities);
  if (!currPlayer) {
    mesh.visible = false;
    return;
  }
  if (!prev) {
    mesh.visible = true;
    mesh.position.set(currPlayer.x, currPlayer.y, 0);
    return;
  }
  const prevPlayer = findPlayer(prev.entities);
  if (!prevPlayer) {
    mesh.visible = true;
    mesh.position.set(currPlayer.x, currPlayer.y, 0);
    return;
  }
  const elapsedMs = pair.nowMs - pair.currReceivedAtMs;
  const renderSimTimeMs = curr.simTimeMs + elapsedMs - SNAPSHOT_INTERVAL_MS;
  const span = curr.simTimeMs - prev.simTimeMs;
  const rawAlpha = span > 0 ? (renderSimTimeMs - prev.simTimeMs) / span : 1;
  const alpha = Math.max(0, Math.min(1, rawAlpha));
  const x = prevPlayer.x + (currPlayer.x - prevPlayer.x) * alpha;
  const y = prevPlayer.y + (currPlayer.y - prevPlayer.y) * alpha;
  mesh.visible = true;
  mesh.position.set(x, y, 0);
}

function findPlayer(
  entities: ReadonlyArray<{ kind: string; x: number; y: number }>
): { x: number; y: number } | null {
  for (const e of entities) {
    if (e.kind === 'player') return { x: e.x, y: e.y };
  }
  return null;
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
