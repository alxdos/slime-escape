import * as THREE from 'three';

import { WEAPON_ARCHETYPES, type WeaponArchetype } from '../../shared/content/weapons';
import type { ProjectileSnapshot, Snapshot } from '../../shared/snapshot';

export const LANDING_TELEGRAPH_NAME = 'landing-telegraph';

const LANDING_TELEGRAPH_OUTLINE_NAME = 'landing-telegraph-outline';
const LANDING_TELEGRAPH_Z = -0.02;
const LANDING_TELEGRAPH_COLOR = 0xff4444;
const LANDING_TELEGRAPH_FILL_OPACITY = 0.18;
const LANDING_TELEGRAPH_OUTLINE_OPACITY = 0.72;
const LANDING_TELEGRAPH_FIXED_DIAMETER_WU = 0.4;
const LANDING_TELEGRAPH_PULSE_MS = 320;
const LANDING_TELEGRAPH_PULSE_OPACITY = 0.1;

export type LandingTelegraphLayer = Readonly<{
  update(snapshot: Snapshot | null, nowMs: number): void;
  clear(): void;
  dispose(): void;
}>;

type LandingTelegraphEntry = Readonly<{
  mesh: THREE.Mesh;
}>;

export function createLandingTelegraphLayer(
  scene: THREE.Scene,
  weaponRegistry: Readonly<Record<string, WeaponArchetype>> = WEAPON_ARCHETYPES
): LandingTelegraphLayer {
  const entries = new Map<number, LandingTelegraphEntry>();

  function ensure(projectileId: number): LandingTelegraphEntry {
    const existing = entries.get(projectileId);
    if (existing !== undefined) return existing;
    const entry = { mesh: createLandingTelegraphMesh() };
    scene.add(entry.mesh);
    entries.set(projectileId, entry);
    return entry;
  }

  function remove(projectileId: number): void {
    const entry = entries.get(projectileId);
    if (entry === undefined) return;
    scene.remove(entry.mesh);
    disposeObjectTree(entry.mesh);
    entries.delete(projectileId);
  }

  function clear(): void {
    for (const projectileId of [...entries.keys()]) remove(projectileId);
  }

  return {
    update(snapshot, nowMs): void {
      const visibleIds = new Set<number>();
      if (snapshot !== null) {
        for (const entity of snapshot.entities) {
          if (entity.kind !== 'projectile') continue;
          if (!shouldShowLandingTelegraph(entity)) continue;
          visibleIds.add(entity.id);
          const entry = ensure(entity.id);
          const diameter = landingTelegraphDiameter(entity, weaponRegistry);
          entry.mesh.position.set(entity.arcEnd.x, entity.arcEnd.y, LANDING_TELEGRAPH_Z);
          entry.mesh.scale.set(diameter, diameter, 1);
          applyLandingTelegraphPulse(entry.mesh, nowMs, entity.id);
        }
      }
      for (const projectileId of [...entries.keys()]) {
        if (!visibleIds.has(projectileId)) remove(projectileId);
      }
    },
    clear,
    dispose(): void {
      clear();
    }
  };
}

export function shouldShowLandingTelegraph(
  snap: ProjectileSnapshot
): snap is ProjectileSnapshot & Readonly<{ arcEnd: Readonly<{ x: number; y: number }> }> {
  return snap.state === 'flying' && snap.arcEnd !== null && snap.ownerKind !== 'player';
}

function landingTelegraphDiameter(
  snap: ProjectileSnapshot,
  weaponRegistry: Readonly<Record<string, WeaponArchetype>>
): number {
  const explosion = weaponRegistry[snap.weaponArchetypeId]?.projectile.explosion ?? null;
  if (explosion === null) return LANDING_TELEGRAPH_FIXED_DIAMETER_WU;
  return explosion.radius * 2;
}

function createLandingTelegraphMesh(): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(0.5, 64);
  const material = new THREE.MeshBasicMaterial({
    color: LANDING_TELEGRAPH_COLOR,
    transparent: true,
    opacity: LANDING_TELEGRAPH_FILL_OPACITY,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = LANDING_TELEGRAPH_NAME;
  mesh.add(createLandingTelegraphOutline());
  return mesh;
}

function createLandingTelegraphOutline(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.48, 0.53, 64);
  const material = new THREE.MeshBasicMaterial({
    color: LANDING_TELEGRAPH_COLOR,
    transparent: true,
    opacity: LANDING_TELEGRAPH_OUTLINE_OPACITY,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = LANDING_TELEGRAPH_OUTLINE_NAME;
  mesh.position.z = 0.001;
  return mesh;
}

function applyLandingTelegraphPulse(mesh: THREE.Mesh, nowMs: number, projectileId: number): void {
  const phase =
    0.5 + 0.5 * Math.sin((nowMs / LANDING_TELEGRAPH_PULSE_MS + projectileId * 0.13) * Math.PI * 2);
  const material = mesh.material;
  if (!Array.isArray(material) && material instanceof THREE.MeshBasicMaterial) {
    material.opacity = LANDING_TELEGRAPH_FILL_OPACITY + LANDING_TELEGRAPH_PULSE_OPACITY * phase;
  }
  const outline = mesh.children.find(
    (child): child is THREE.Mesh =>
      child instanceof THREE.Mesh && child.name === LANDING_TELEGRAPH_OUTLINE_NAME
  );
  const outlineMaterial = outline?.material;
  if (!Array.isArray(outlineMaterial) && outlineMaterial instanceof THREE.MeshBasicMaterial) {
    outlineMaterial.opacity =
      LANDING_TELEGRAPH_OUTLINE_OPACITY + LANDING_TELEGRAPH_PULSE_OPACITY * phase;
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
