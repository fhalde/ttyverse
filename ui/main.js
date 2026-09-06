import { Channel, invoke } from "@tauri-apps/api/core";
import { FitAddon } from "@xterm/addon-fit";
import { CanvasAddon } from "@xterm/addon-canvas";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import "./style.css";

const terminals = new Map();
const sources = document.querySelector("#terminals");
const canvas = document.querySelector("#scene");

for (let id = 0; id < 2; id += 1) {
  const pane = document.createElement("section");
  sources.append(pane);
  const terminal = new Terminal({
    cursorBlink: true,
    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
    fontSize: 14,
    theme: { background: "#1e1e26", foreground: "#f0f0f5" }
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(pane);
  terminal.loadAddon(new CanvasAddon());
  fit.fit();
  terminal.writeln("\x1b[90mConnecting terminal…\x1b[0m");
  terminal.onData((data) => invoke("write_terminal", { id, data }));
  terminals.set(id, { terminal, fit, pane });
}

function resizeTerminals() {
  for (const [id, { terminal, fit }] of terminals) {
    fit.fit();
    invoke("resize_terminal", { id, cols: terminal.cols, rows: terminal.rows });
  }
}

try {
await Promise.all([...terminals.keys()].map((id) => {
  const onOutput = new Channel();
  onOutput.onmessage = (payload) => {
    terminals.get(payload.id)?.terminal.write(new Uint8Array(payload.data));
  };
  return invoke("create_terminal", { id, onOutput });
}));
} catch (error) {
  for (const { terminal } of terminals.values()) {
    terminal.writeln(`\x1b[31mTerminal bridge failed: ${error}\x1b[0m`);
  }
}

const scene = new THREE.Scene();
scene.background = new THREE.Color("#111118");
scene.fog = new THREE.Fog("#111118", 10, 32);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0, 18);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.enableRotate = false;
controls.minDistance = 8;
controls.maxDistance = 28;
scene.add(new THREE.HemisphereLight("#d7ddff", "#101018", 2));

const planes = [];
for (const [id, { pane }] of terminals) {
  const source = pane.querySelector("canvas.xterm-text-layer");
  if (!source) throw new Error("xterm canvas renderer did not create a text layer");
  const composite = document.createElement("canvas");
  composite.width = source.width;
  composite.height = source.height;
  const context = composite.getContext("2d");
  const texture = new THREE.CanvasTexture(composite);
  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
  }
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8 * source.height / source.width),
    new THREE.MeshBasicMaterial({ map: texture, color: "#ffffff", fog: false })
  );
  plane.position.set(id === 0 ? -4.5 : 4.5, 0, id === 0 ? 0 : -1.8);
  plane.userData = { id, texture, pane, composite, context };
  scene.add(plane);
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(plane.geometry),
    new THREE.LineBasicMaterial({ color: "#9ca8ff" })
  );
  frame.position.copy(plane.position);
  frame.rotation.copy(plane.rotation);
  frame.scale.setScalar(1.01);
  scene.add(frame);
  planes.push(plane);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
canvas.addEventListener("pointerdown", (event) => {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(planes)[0];
  if (hit) terminals.get(hit.object.userData.id).terminal.focus();
});

function resizeScene() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeTerminals();
}
window.addEventListener("resize", resizeScene);
resizeScene();

function render() {
  requestAnimationFrame(render);
  for (const plane of planes) {
    const { texture, pane, composite, context } = plane.userData;
    context.fillStyle = "#1e1e26";
    context.fillRect(0, 0, composite.width, composite.height);
    for (const layer of pane.querySelectorAll(".xterm-screen canvas")) {
      if (layer.width && layer.height) context.drawImage(layer, 0, 0, composite.width, composite.height);
    }
    texture.needsUpdate = true;
  }
  controls.update();
  renderer.render(scene, camera);
}
render();
