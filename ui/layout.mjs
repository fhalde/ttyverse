import * as THREE from "three";

export const PLANAR_DEPTH = 6;

export function planarPosition(position) {
  return new THREE.Vector3(position.x, position.y, PLANAR_DEPTH);
}

export function placeTerminal(plane, position, planes) {
  const { width, height } = plane.geometry.parameters;
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(plane.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(plane.quaternion);
  const occupied = planes.map(existing => new THREE.Box3().setFromObject(existing)
    .expandByScalar(0.5));
  const bounds = new THREE.Box3();
  const tryPosition = (column, row) => {
    plane.position.copy(position)
      .addScaledVector(right, column * (width + 1.5))
      .addScaledVector(up, row * (height + 1.5));
    bounds.setFromObject(plane).expandByScalar(0.5);
    return occupied.every(other => !bounds.intersectsBox(other));
  };
  if (tryPosition(0, 0)) return;
  // Search outward locally, with enough clearance for differently sized windows.
  for (let ring = 1; ; ring++) {
    const candidates = [];
    for (let row = -ring; row <= ring; row++) {
      for (let column = -ring; column <= ring; column++) {
        if (Math.max(Math.abs(column), Math.abs(row)) !== ring) continue;
        candidates.push({ column, row });
      }
    }
    candidates.sort((a, b) => a.column ** 2 + a.row ** 2 - b.column ** 2 - b.row ** 2
      || Math.abs(a.row) - Math.abs(b.row));
    for (const { column, row } of candidates) {
      if (tryPosition(column, row)) return;
    }
  }
}
