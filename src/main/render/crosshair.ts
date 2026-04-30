import * as THREE from 'three';

export type AimAccessor = () => { x: number; y: number } | null;

export const CROSSHAIR_COLOR = 0xffe066;

const CROSSHAIR_OPACITY = 0.78;
const CROSSHAIR_OUTLINE_COLOR = 0x050505;
const CROSSHAIR_OUTLINE_OPACITY = 1;
const CROSSHAIR_OUTLINE_WIDTH_WU = 0.018;
const CROSSHAIR_OUTLINE_NAME = 'crosshair-outline';
const CROSSHAIR_OUTLINE_RENDER_ORDER = 20;
const CROSSHAIR_RENDER_ORDER = 21;
const CROSSHAIR_SIZE_WU = 0.6;
const CROSSHAIR_THICKNESS_WU = 0.05;

export function createCrosshair(): THREE.Group {
  const material = new THREE.MeshBasicMaterial({
    color: CROSSHAIR_COLOR,
    transparent: true,
    opacity: CROSSHAIR_OPACITY,
    depthTest: false,
    depthWrite: false
  });
  const horizontal = new THREE.Mesh(
    new THREE.PlaneGeometry(CROSSHAIR_SIZE_WU, CROSSHAIR_THICKNESS_WU),
    material
  );
  const vertical = new THREE.Mesh(
    new THREE.PlaneGeometry(CROSSHAIR_THICKNESS_WU, CROSSHAIR_SIZE_WU),
    material
  );
  const group = new THREE.Group();
  group.name = 'crosshair';
  group.add(createCrosshairOutline());
  group.add(horizontal);
  group.add(vertical);
  group.position.z = 0.1;
  group.renderOrder = CROSSHAIR_RENDER_ORDER;
  horizontal.renderOrder = CROSSHAIR_RENDER_ORDER;
  vertical.renderOrder = CROSSHAIR_RENDER_ORDER;
  return group;
}

export function updateCrosshair(group: THREE.Group, getAim: AimAccessor | undefined): void {
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

export function disposeCrosshair(group: THREE.Group): void {
  const disposedMaterials = new Set<THREE.Material>();
  for (const child of group.children) {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) {
        for (const entry of material) {
          if (disposedMaterials.has(entry)) continue;
          entry.dispose();
          disposedMaterials.add(entry);
        }
      } else if (!disposedMaterials.has(material)) {
        material.dispose();
        disposedMaterials.add(material);
      }
    }
  }
}

function createCrosshairOutline(): THREE.Mesh {
  const halfSize = CROSSHAIR_SIZE_WU / 2;
  const halfThickness = CROSSHAIR_THICKNESS_WU / 2;
  const shape = createPlusShape(
    halfSize + CROSSHAIR_OUTLINE_WIDTH_WU,
    halfThickness + CROSSHAIR_OUTLINE_WIDTH_WU
  );
  shape.holes.push(createPlusPath(halfSize, halfThickness, true));
  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshBasicMaterial({
    color: CROSSHAIR_OUTLINE_COLOR,
    transparent: true,
    opacity: CROSSHAIR_OUTLINE_OPACITY,
    depthTest: false,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = CROSSHAIR_OUTLINE_NAME;
  mesh.position.z = -0.001;
  mesh.renderOrder = CROSSHAIR_OUTLINE_RENDER_ORDER;
  return mesh;
}

function createPlusShape(halfLength: number, halfThickness: number): THREE.Shape {
  const shape = new THREE.Shape();
  addPlusPathPoints(shape, halfLength, halfThickness, false);
  return shape;
}

function createPlusPath(halfLength: number, halfThickness: number, reverse: boolean): THREE.Path {
  const path = new THREE.Path();
  addPlusPathPoints(path, halfLength, halfThickness, reverse);
  return path;
}

function addPlusPathPoints(
  path: THREE.Path,
  halfLength: number,
  halfThickness: number,
  reverse: boolean
): void {
  const points: THREE.Vector2[] = [
    new THREE.Vector2(-halfThickness, -halfLength),
    new THREE.Vector2(halfThickness, -halfLength),
    new THREE.Vector2(halfThickness, -halfThickness),
    new THREE.Vector2(halfLength, -halfThickness),
    new THREE.Vector2(halfLength, halfThickness),
    new THREE.Vector2(halfThickness, halfThickness),
    new THREE.Vector2(halfThickness, halfLength),
    new THREE.Vector2(-halfThickness, halfLength),
    new THREE.Vector2(-halfThickness, halfThickness),
    new THREE.Vector2(-halfLength, halfThickness),
    new THREE.Vector2(-halfLength, -halfThickness),
    new THREE.Vector2(-halfThickness, -halfThickness)
  ];
  const contour = reverse ? points.reverse() : points;
  path.moveTo(contour[0]!.x, contour[0]!.y);
  for (const point of contour.slice(1)) path.lineTo(point.x, point.y);
  path.closePath();
}
