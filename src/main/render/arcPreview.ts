import * as THREE from 'three';

import { WEAPON_ARCHETYPES, type WeaponArchetype } from '../../shared/content/weapons';
import { CROSSHAIR_COLOR } from './crosshair';

export const ARC_PREVIEW_NAME = 'arc-preview';
export const ARC_PREVIEW_OUTLINE_NAME = 'arc-preview-outline';

const ARC_PREVIEW_Z = 0.04;
const ARC_PREVIEW_RADIUS_WU = 0.18;
const ARC_PREVIEW_OUTLINE_COLOR = 0xd97706;
const ARC_PREVIEW_OUTLINE_OPACITY = 0.72;

export type ArcPreviewPoint = Readonly<{ x: number; y: number }>;

export type ArcPreviewState = Readonly<{
  player: ArcPreviewPoint | null;
  aim: ArcPreviewPoint | null;
  weaponArchetypeId: string | null;
  weaponRegistry?: Readonly<Record<string, WeaponArchetype>>;
}>;

export function createArcPreview(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.72, 1, 36);
  const material = new THREE.MeshBasicMaterial({
    color: CROSSHAIR_COLOR,
    transparent: true,
    opacity: 0.52,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = ARC_PREVIEW_NAME;
  mesh.position.z = ARC_PREVIEW_Z;
  mesh.add(createArcPreviewOutline());
  mesh.scale.set(ARC_PREVIEW_RADIUS_WU, ARC_PREVIEW_RADIUS_WU, 1);
  mesh.visible = false;
  return mesh;
}

export function updateArcPreview(mesh: THREE.Mesh, state: ArcPreviewState): void {
  const { aim, player, weaponArchetypeId } = state;
  const weaponRegistry = state.weaponRegistry ?? WEAPON_ARCHETYPES;
  if (aim === null || player === null || weaponArchetypeId === null) {
    mesh.visible = false;
    return;
  }
  const archetype = weaponRegistry[weaponArchetypeId];
  if (archetype === undefined) {
    mesh.visible = false;
    return;
  }
  const motion = archetype.projectile.motion;
  if (motion.kind !== 'arc') {
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
  const radius = Math.max(ARC_PREVIEW_RADIUS_WU, archetype.projectile.hitRadius);
  mesh.scale.set(radius, radius, 1);
}

function createArcPreviewOutline(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.62, 1.1, 48);
  const material = new THREE.MeshBasicMaterial({
    color: ARC_PREVIEW_OUTLINE_COLOR,
    transparent: true,
    opacity: ARC_PREVIEW_OUTLINE_OPACITY,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = ARC_PREVIEW_OUTLINE_NAME;
  mesh.position.z = -0.002;
  return mesh;
}
