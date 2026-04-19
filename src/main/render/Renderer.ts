import * as THREE from 'three';

import { SNAPSHOT_INTERVAL_MS } from '../../shared/timing';
import type { SnapshotPair } from '../sim/SimWorkerHost';

export type RendererInit = Readonly<{
  canvas: HTMLCanvasElement;
  pixelRatio: number;
  width: number;
  height: number;
  getSnapshotPair: () => SnapshotPair;
}>;

export type Renderer = Readonly<{
  render(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}>;

const ENTITY_HALF_SIZE = 0.05;
const ENTITY_COLOR = 0x9ad6ff;
const SCENE_BG = 0x101218;

export function createRenderer(init: RendererInit): Renderer {
  const renderer = new THREE.WebGLRenderer({ canvas: init.canvas, antialias: true });
  renderer.setPixelRatio(init.pixelRatio);
  renderer.setSize(init.width, init.height, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BG);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  applyAspect(camera, init.width / init.height);

  const geometry = new THREE.BoxGeometry(
    ENTITY_HALF_SIZE * 2,
    ENTITY_HALF_SIZE * 2,
    ENTITY_HALF_SIZE * 2
  );
  const material = new THREE.MeshBasicMaterial({ color: ENTITY_COLOR });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  return {
    render(): void {
      updateMeshPosition(mesh, init.getSnapshotPair());
      renderer.render(scene, camera);
    },
    resize(width: number, height: number): void {
      renderer.setSize(width, height, false);
      applyAspect(camera, width / height);
    },
    dispose(): void {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    }
  };
}

function applyAspect(camera: THREE.OrthographicCamera, aspect: number): void {
  const halfH = 1;
  const halfW = halfH * aspect;
  camera.left = -halfW;
  camera.right = halfW;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
}

function updateMeshPosition(mesh: THREE.Mesh, pair: SnapshotPair): void {
  const { prev, curr } = pair;
  if (!curr) {
    return;
  }
  const currEntity = curr.entities[0];
  if (!currEntity) {
    return;
  }
  if (!prev) {
    mesh.position.set(currEntity.x, currEntity.y, 0);
    return;
  }
  const prevEntity = prev.entities[0];
  if (!prevEntity) {
    mesh.position.set(currEntity.x, currEntity.y, 0);
    return;
  }
  const elapsedMs = pair.nowMs - pair.currReceivedAtMs;
  const renderSimTimeMs = curr.simTimeMs + elapsedMs - SNAPSHOT_INTERVAL_MS;
  const span = curr.simTimeMs - prev.simTimeMs;
  const rawAlpha = span > 0 ? (renderSimTimeMs - prev.simTimeMs) / span : 1;
  const alpha = Math.max(0, Math.min(1, rawAlpha));
  const x = prevEntity.x + (currEntity.x - prevEntity.x) * alpha;
  const y = prevEntity.y + (currEntity.y - prevEntity.y) * alpha;
  mesh.position.set(x, y, 0);
}
