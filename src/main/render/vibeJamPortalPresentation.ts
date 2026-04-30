import * as THREE from 'three';

import type { VibeJamPortalDescriptor } from '../VibeJamPortalController';

export const VIBE_JAM_PORTAL_GROUP_NAME = 'vibe-jam-portal';
export const VIBE_JAM_PORTAL_INTERIOR_NAME = 'vibe-jam-portal-interior';
export const VIBE_JAM_PORTAL_OUTLINE_NAME = 'vibe-jam-portal-outline';
export const VIBE_JAM_PORTAL_RETURN_LABEL_NAME = 'vibe-jam-portal-return-label';

export type VibeJamPortalMeshEntry = Readonly<{
  group: THREE.Group;
  interior: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  outline: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  label: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
}>;

const PORTAL_Z = 0.16;
const PORTAL_INTERIOR_COLOR = 0x000000;
const PORTAL_PURPLE = 0x8b5cf6;
const PORTAL_LIME = 0xa7f070;
const PORTAL_CYAN = 0x5ee7ff;
const PORTAL_PINK = 0xff6bd5;
const PORTAL_OUTLINE_OPACITY = 0.94;
const PORTAL_RENDER_ORDER = 18;
const PORTAL_RETURN_LABEL_WIDTH = 1.24;
const PORTAL_RETURN_LABEL_HEIGHT = 0.32;
const PORTAL_RETURN_LABEL_Y = -0.86;
const PORTAL_PURPLE_COLOR = new THREE.Color(PORTAL_PURPLE);
const PORTAL_LIME_COLOR = new THREE.Color(PORTAL_LIME);
const PORTAL_CYAN_COLOR = new THREE.Color(PORTAL_CYAN);
const PORTAL_PINK_COLOR = new THREE.Color(PORTAL_PINK);

export function updateVibeJamPortalMeshes(
  descriptors: ReadonlyArray<VibeJamPortalDescriptor>,
  entries: Map<VibeJamPortalDescriptor['kind'], VibeJamPortalMeshEntry>,
  scene: THREE.Scene,
  nowMs: number,
  prefersReducedMotion: boolean
): void {
  const active = new Set<VibeJamPortalDescriptor['kind']>();
  for (const descriptor of descriptors) {
    active.add(descriptor.kind);
    const entry = ensurePortalMesh(entries, scene, descriptor.kind);
    entry.group.position.x = descriptor.x;
    entry.group.position.y = descriptor.y;
    entry.group.scale.set(descriptor.width, descriptor.height, 1);
    applyPortalLabelPresentation(entry.label, descriptor);
    applyPortalPresentation(entry, descriptor.kind, nowMs, prefersReducedMotion);
  }

  for (const [kind, entry] of entries) {
    if (active.has(kind)) continue;
    disposeVibeJamPortalMesh(scene, entry);
    entries.delete(kind);
  }
}

export function disposeVibeJamPortalMesh(
  scene: THREE.Scene,
  entry: VibeJamPortalMeshEntry
): void {
  scene.remove(entry.group);
  entry.label.material.map?.dispose();
  disposeObjectTree(entry.group);
}

function ensurePortalMesh(
  entries: Map<VibeJamPortalDescriptor['kind'], VibeJamPortalMeshEntry>,
  scene: THREE.Scene,
  kind: VibeJamPortalDescriptor['kind']
): VibeJamPortalMeshEntry {
  const existing = entries.get(kind);
  if (existing !== undefined) return existing;
  const entry = createPortalMesh();
  scene.add(entry.group);
  entries.set(kind, entry);
  return entry;
}

function createPortalMesh(): VibeJamPortalMeshEntry {
  const group = new THREE.Group();
  group.name = VIBE_JAM_PORTAL_GROUP_NAME;
  group.position.z = PORTAL_Z;
  group.renderOrder = PORTAL_RENDER_ORDER;

  const interior = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 64),
    new THREE.MeshBasicMaterial({
      color: PORTAL_INTERIOR_COLOR,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      depthTest: false
    })
  );
  interior.name = VIBE_JAM_PORTAL_INTERIOR_NAME;
  interior.renderOrder = PORTAL_RENDER_ORDER;
  group.add(interior);

  const outline = new THREE.Mesh(
    new THREE.RingGeometry(0.52, 0.68, 64),
    new THREE.MeshBasicMaterial({
      color: PORTAL_PURPLE,
      transparent: true,
      opacity: PORTAL_OUTLINE_OPACITY,
      depthWrite: false,
      depthTest: false
    })
  );
  outline.name = VIBE_JAM_PORTAL_OUTLINE_NAME;
  outline.position.z = 0.01;
  outline.renderOrder = PORTAL_RENDER_ORDER + 1;
  group.add(outline);

  const label = createReturnPortalLabelMesh();
  group.add(label);

  return { group, interior, outline, label };
}

function createReturnPortalLabelMesh(): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PORTAL_RETURN_LABEL_WIDTH, PORTAL_RETURN_LABEL_HEIGHT),
    createReturnPortalLabelMaterial()
  );
  mesh.name = VIBE_JAM_PORTAL_RETURN_LABEL_NAME;
  mesh.position.set(0, PORTAL_RETURN_LABEL_Y, 0.02);
  mesh.renderOrder = PORTAL_RENDER_ORDER + 2;
  mesh.visible = false;
  return mesh;
}

function createReturnPortalLabelMaterial(): THREE.MeshBasicMaterial {
  const texture = createReturnPortalLabelTexture();
  return new THREE.MeshBasicMaterial({
    map: texture,
    color: texture === null ? 0xf7f2ff : 0xffffff,
    transparent: true,
    opacity: texture === null ? 0.72 : 0.98,
    depthWrite: false,
    depthTest: false
  });
}

function createReturnPortalLabelTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '900 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(5, 6, 10, 0.9)';
  ctx.strokeText('RETURN', canvas.width / 2, canvas.height / 2 + 2);
  ctx.fillStyle = 'rgba(247, 242, 255, 0.96)';
  ctx.fillText('RETURN', canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function applyPortalLabelPresentation(
  label: VibeJamPortalMeshEntry['label'],
  descriptor: VibeJamPortalDescriptor
): void {
  label.visible = descriptor.kind === 'return';
  label.scale.set(
    1 / Math.max(0.001, descriptor.width),
    1 / Math.max(0.001, descriptor.height),
    1
  );
}

function applyPortalPresentation(
  entry: VibeJamPortalMeshEntry,
  kind: VibeJamPortalDescriptor['kind'],
  nowMs: number,
  prefersReducedMotion: boolean
): void {
  const shimmer = prefersReducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(nowMs / 220);
  const from = kind === 'exit' ? PORTAL_CYAN_COLOR : PORTAL_PURPLE_COLOR;
  const to = kind === 'exit' ? PORTAL_PINK_COLOR : PORTAL_LIME_COLOR;
  entry.outline.material.color.copy(from).lerp(to, shimmer);
  entry.outline.material.opacity = prefersReducedMotion
    ? PORTAL_OUTLINE_OPACITY
    : 0.82 + 0.16 * shimmer;
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
        entry.dispose();
      }
    } else if (material !== undefined) {
      material.dispose();
    }
  });
}
