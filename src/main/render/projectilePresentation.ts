import * as THREE from 'three';

import { WEAPON_ARCHETYPES, type WeaponArchetype } from '../../shared/content/weapons';
import { PROJECTILE_VISUALS } from './projectileVisuals';
import type { SpriteVisualSpec } from './SpriteVisualSpec';

export const PROJECTILE_RADIUS_INDICATOR_NAME = 'projectile-radius-indicator';

const PROJECTILE_RADIUS_OUTLINE_NAME = 'projectile-radius-outline';
const PROJECTILE_RADIUS_Z = -0.01;
const PROJECTILE_RADIUS_COLOR = 0xffd166;
const PROJECTILE_RADIUS_OPACITY = 0.14;
const PROJECTILE_RADIUS_OUTLINE_COLOR = 0xd97706;
const PROJECTILE_RADIUS_OUTLINE_OPACITY = 0.54;
const PROJECTILE_GROUNDED_PULSE_AMPLITUDE = 0.1;

export type ProjectilePresentationSnapshot = Readonly<{
  weaponArchetypeId: string;
  originX: number;
  originY: number;
  x: number;
  y: number;
  size: Readonly<{ width: number; height: number }>;
  state: 'flying' | 'grounded';
  visualState: Readonly<{
    angleRadians: number;
    spinRadians: number;
    pulsePhase: number;
  }>;
  explosionRadius: number | null;
}>;

export function createProjectileRadiusIndicator(): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(1, 48);
  const material = new THREE.MeshBasicMaterial({
    color: PROJECTILE_RADIUS_COLOR,
    transparent: true,
    opacity: PROJECTILE_RADIUS_OPACITY,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = PROJECTILE_RADIUS_INDICATOR_NAME;
  mesh.position.z = PROJECTILE_RADIUS_Z;
  mesh.add(createRadiusOutlineMesh(1.01, 1.09, PROJECTILE_RADIUS_OUTLINE_NAME));
  mesh.visible = false;
  return mesh;
}

export function applyProjectilePresentation(
  mesh: THREE.Mesh,
  snap: ProjectilePresentationSnapshot,
  weaponRegistry: Readonly<Record<string, WeaponArchetype>> = WEAPON_ARCHETYPES,
  hideDistance = 0
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
  const baseVisual = requireProjectileVisualSpec(snap.weaponArchetypeId);
  const sizeScaleX = snap.size.width / baseVisual.worldSize.width;
  const sizeScaleY = snap.size.height / baseVisual.worldSize.height;
  mesh.scale.set(sizeScaleX * pulse, sizeScaleY * pulse, 1);

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
  radiusIndicator.scale.set(
    snap.explosionRadius / sizeScaleX,
    snap.explosionRadius / sizeScaleY,
    1
  );
  const radiusMaterial = radiusIndicator.material;
  if (!Array.isArray(radiusMaterial) && radiusMaterial instanceof THREE.MeshBasicMaterial) {
    const phase = 0.5 + 0.5 * Math.sin(snap.visualState.pulsePhase * Math.PI * 2);
    radiusMaterial.opacity = 0.08 + 0.08 * phase;
  }
  return shouldShow;
}

function createRadiusOutlineMesh(innerRadius: number, outerRadius: number, name: string): THREE.Mesh {
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 48);
  const material = new THREE.MeshBasicMaterial({
    color: PROJECTILE_RADIUS_OUTLINE_COLOR,
    transparent: true,
    opacity: PROJECTILE_RADIUS_OUTLINE_OPACITY,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

function requireProjectileVisualSpec(archetypeId: string): SpriteVisualSpec {
  const visual = PROJECTILE_VISUALS[archetypeId];
  if (visual === undefined) {
    throw new Error(`projectile visual missing for archetype "${archetypeId}"`);
  }
  return visual;
}

function shouldShowProjectile(
  snap: ProjectilePresentationSnapshot,
  hideDistance: number
): boolean {
  if (snap.state !== 'flying') return true;
  if (hideDistance <= 0) return true;
  const dx = snap.x - snap.originX;
  const dy = snap.y - snap.originY;
  return dx * dx + dy * dy >= hideDistance * hideDistance;
}
