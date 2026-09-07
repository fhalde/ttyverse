import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { PLANAR_DEPTH, planarPosition, planarLookPosition, placeTerminal } from "./layout.mjs";

test("planar placement follows the center of view from either side", () => {
  for (const z of [18, -6]) {
    const position = new THREE.Vector3(20, 30, z);
    const target = new THREE.Vector3(32, 36, PLANAR_DEPTH);
    const direction = target.clone().sub(position).normalize();
    assert.ok(planarLookPosition(position, direction).distanceTo(target) < 1e-10);
  }
});

test("looking away, parallel, or nearly parallel keeps placement nearby", () => {
  const position = new THREE.Vector3(20, 30, 18);
  for (const direction of [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(1, 0, 1).normalize(),
    new THREE.Vector3(1, 0, -1e-8).normalize()
  ]) {
    const target = planarLookPosition(position, direction);
    assert.equal(target.z, PLANAR_DEPTH);
    assert.ok(target.distanceTo(planarPosition(position)) <= 12.000001);
  }
});

function addTerminal(planes, position, height = 6) {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(8, height));
  placeTerminal(plane, planarPosition(position), planes);
  planes.push(plane);
  return plane;
}

function assertClear(planes) {
  for (let i = 0; i < planes.length; i++) {
    const bounds = new THREE.Box3().setFromObject(planes[i]).expandByScalar(0.5);
    for (const other of planes.slice(i + 1)) {
      assert.equal(bounds.intersectsBox(new THREE.Box3().setFromObject(other).expandByScalar(0.5)), false);
    }
    assert.equal(planes[i].position.z, PLANAR_DEPTH);
  }
}

test("repeated creation stays on one plane without overlap, including mixed sizes", () => {
  const planes = [];
  for (let i = 0; i < 60; i++) {
    addTerminal(planes, new THREE.Vector3(0, 0, 18 + i), 5 + i % 4);
  }
  assertClear(planes);
});

test("moving to another region starts a local cluster, and returning avoids old terminals", () => {
  const planes = [];
  const origin = new THREE.Vector3(0, 0, 18);
  for (let i = 0; i < 8; i++) addTerminal(planes, origin);
  const remote = new THREE.Vector3(180, -120, -50);
  assert.deepEqual(addTerminal(planes, remote).position, planarPosition(remote));
  for (let i = 0; i < 8; i++) addTerminal(planes, remote);
  const returned = addTerminal(planes, origin);
  assert.ok(returned.position.distanceTo(planarPosition(origin)) < 40);
  assertClear(planes);
});

test("flattening terminals at different depths resolves projected collisions", () => {
  const planes = [];
  for (const depth of [-100, 0, 6, 100]) {
    addTerminal(planes, new THREE.Vector3(12, 9, depth));
  }
  assertClear(planes);
});
