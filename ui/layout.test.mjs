import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { PLANAR_DEPTH, planarPosition, placeTerminal } from "./layout.mjs";

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
