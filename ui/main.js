import { Channel, invoke } from "@tauri-apps/api/core";
import { FitAddon } from "@xterm/addon-fit";
import { CanvasAddon } from "@xterm/addon-canvas";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import * as THREE from "three";
import "./style.css";

const sources = document.querySelector("#terminals");
const canvas = document.querySelector("#scene");
const hud = document.createElement("aside");
hud.id = "hud";
document.body.append(hud);
const speedControl = document.createElement("div");
speedControl.id = "speed-control";
speedControl.innerHTML = '<button type="button" aria-label="Decrease flight speed">−</button><output></output><button type="button" aria-label="Increase flight speed">+</button>';
document.body.append(speedControl);
const speeds = [0.5, 1, 2, 4, 8];
let speedIndex = 1;
function changeSpeed(delta) {
  speedIndex = Math.max(0, Math.min(speeds.length - 1, speedIndex + delta));
  speedControl.querySelector("output").textContent = "Flight speed " + speeds[speedIndex] + "×";
  speedControl.firstElementChild.disabled = speedIndex === 0;
  speedControl.lastElementChild.disabled = speedIndex === speeds.length - 1;
}
speedControl.firstElementChild.addEventListener("click", () => changeSpeed(-1));
speedControl.lastElementChild.addEventListener("click", () => changeSpeed(1));
speedControl.addEventListener("pointerdown", event => event.preventDefault());
changeSpeed(0);
const reticle = document.createElement("div");
reticle.id = "reticle";
reticle.textContent = "+";
document.body.append(reticle);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#111118");
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
camera.position.set(0, 0, 18);
camera.rotation.order = "YXZ";
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

// A sparse field provides motion parallax while flying between terminals.
const positions = new Float32Array(1800);
for (let i = 0; i < positions.length; i++) positions[i] = (Math.random() - 0.5) * 500;
const stars = new THREE.BufferGeometry();
stars.setAttribute("position", new THREE.BufferAttribute(positions, 3));
scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: "#6a789a", size: 0.12 })));

const terminals = new Map();
let selectedFont = localStorage.getItem("terminal-font") || "Menlo";
const fontControl = document.createElement("label");
fontControl.id = "font-control";
fontControl.textContent = "Terminal font ";
const fontSelect = document.createElement("select");
fontSelect.setAttribute("aria-label", "Terminal font");
fontSelect.add(new Option(selectedFont, selectedFont));
fontControl.append(fontSelect);
document.body.append(fontControl);
function fontFamily() {
  return JSON.stringify(selectedFont) + ", monospace";
}
invoke("list_system_fonts").then(families => {
  const names = [...new Set([selectedFont, ...families])].sort((a, b) => a.localeCompare(b));
  fontSelect.replaceChildren(...names.map(name => new Option(name, name)));
  fontSelect.value = selectedFont;
}).catch(error => { fontSelect.title = "Unable to list fonts: " + error; });
fontSelect.addEventListener("change", async () => {
  selectedFont = fontSelect.value;
  localStorage.setItem("terminal-font", selectedFont);
  await document.fonts.load("14px " + JSON.stringify(selectedFont));
  for (const [id, item] of terminals) {
    item.terminal.options.fontFamily = fontFamily();
    item.fit.fit();
    item.terminal.refresh(0, item.terminal.rows - 1);
    item.dirty = true;
    if (item.ready) {
      invoke("resize_terminal", { id, cols: item.terminal.cols, rows: item.terminal.rows })
        .catch(error => updateHud(String(error)));
    }
  }
});
const planes = [];
const keys = new Set();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let nextId = 0;
let active = null;
let flying = false;
let dragging = false;

function updateHud(note = "") {
  hud.textContent = (active === null ? "FLIGHT" : "TERMINAL " + (active + 1))
    + " · ⌘/Ctrl+T new terminal · "
    + (active === null
      ? "WASD move · Q/E down/up · Shift boost · mouse to look · F capture mouse · click terminal to type"
      : "Esc return to flight")
    + (note ? " · " + note : "");
  reticle.hidden = !flying;
}

function flight() {
  if (active !== null) terminals.get(active)?.terminal.blur();
  active = null;
  keys.clear();
  velocity.set(0, 0, 0);
  updateHud();
}

function focusTerminal(id) {
  if (document.pointerLockElement) document.exitPointerLock();
  flight();
  active = id;
  const { plane, terminal } = terminals.get(id);
  const { width, height } = plane.geometry.parameters;
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const distance = Math.max(height / 2, width / (2 * camera.aspect)) / Math.tan(halfFov) * 1.2;
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(plane.quaternion);
  camera.position.copy(plane.position).addScaledVector(normal, distance);
  camera.lookAt(plane.position);
  terminal.focus();
  updateHud();
}

async function createTerminal(position) {
  const id = nextId++;
  const pane = document.createElement("section");
  sources.append(pane);
  const terminal = new Terminal({
    cursorBlink: true,
    fontFamily: fontFamily(),
    fontSize: 14,
    theme: { background: "#1e1e26", foreground: "#f0f0f5" }
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(pane);
  terminal.loadAddon(new CanvasAddon());
  fit.fit();

  const source = pane.querySelector("canvas.xterm-text-layer");
  if (!source) throw new Error("Terminal canvas renderer unavailable");
  const composite = document.createElement("canvas");
  composite.width = source.width;
  composite.height = source.height;
  const texture = new THREE.CanvasTexture(composite);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8 * source.height / source.width),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
  );
  plane.position.copy(position);
  // New terminals face the pilot, upright without roll or pitch.
  if (id >= 2) plane.rotation.y = camera.rotation.y;
  plane.userData.id = id;
  scene.add(plane);
  planes.push(plane);
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(plane.geometry),
    new THREE.LineBasicMaterial({ color: "#7383a4" })
  );
  plane.add(frame);
  const item = { terminal, fit, pane, plane, frame, texture, composite,
    context: composite.getContext("2d"), dirty: true, ready: false };
  terminals.set(id, item);
  terminal.onRender(() => { item.dirty = true; });
  terminal.onData((data) => {
    if (item.ready) invoke("write_terminal", { id, data }).catch(error => updateHud(String(error)));
  });
  const onOutput = new Channel();
  item.channel = onOutput;
  onOutput.onmessage = (payload) => terminal.write(new Uint8Array(payload.data));
  try {
    await invoke("create_terminal", { id, onOutput });
    item.ready = true;
    await invoke("resize_terminal", { id, cols: terminal.cols, rows: terminal.rows });
  } catch (error) {
    terminal.writeln("Terminal failed: " + error);
    updateHud(String(error));
  }
}

function spawnAhead() {
  camera.getWorldDirection(direction);
  const position = camera.position.clone().addScaledVector(direction, 12);
  flight();
  void createTerminal(position).catch(error => updateHud(String(error)));
}

function look(dx, dy) {
  camera.rotation.y -= dx * 0.002;
  camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - dy * 0.002, -1.5, 1.5);
}

window.addEventListener("keydown", event => {
  if (event.target.closest?.("#font-control")) return;
  if ((event.metaKey || event.ctrlKey) && event.code === "KeyT") {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) spawnAhead();
    return;
  }
  if (event.code === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    document.exitPointerLock?.();
    flight();
    return;
  }
  if (active !== null || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.code === "KeyF" && !event.repeat) {
    event.preventDefault();
    canvas.requestPointerLock?.()?.catch?.(() => updateHud("Mouse capture unavailable; drag to look"));
  }
  if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "ShiftLeft", "ShiftRight"].includes(event.code)) {
    event.preventDefault();
    keys.add(event.code);
  }
}, true);
window.addEventListener("keyup", event => keys.delete(event.code), true);
window.addEventListener("blur", () => { keys.clear(); velocity.set(0, 0, 0); dragging = false; });
document.addEventListener("pointerlockchange", () => {
  flying = document.pointerLockElement === canvas;
  keys.clear();
  updateHud();
});
document.addEventListener("pointerlockerror", () => updateHud("Drag mouse to look"));
document.addEventListener("mousemove", event => {
  if (active === null && !event.target.closest?.("#font-control, #speed-control")) look(event.movementX, event.movementY);
});
let down = null;
canvas.addEventListener("pointerdown", event => {
  if (active !== null) flight();
  down = { x: event.clientX, y: event.clientY };
  dragging = !flying;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointerup", event => {
  dragging = false;
  if (!down) return;
  const distance = Math.hypot(event.clientX - down.x, event.clientY - down.y);
  down = null;
  if (distance > 4 && !flying) return;
  const bounds = canvas.getBoundingClientRect();
  pointer.set(flying ? 0 : (event.clientX - bounds.left) / bounds.width * 2 - 1,
    flying ? 0 : -(event.clientY - bounds.top) / bounds.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(planes, false)[0];
  if (hit) focusTerminal(hit.object.userData.id);
});
canvas.addEventListener("pointercancel", () => { dragging = false; down = null; });
canvas.addEventListener("contextmenu", event => event.preventDefault());

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
resize();
updateHud();
void createTerminal(new THREE.Vector3(-4.5, 0, 0));
void createTerminal(new THREE.Vector3(4.5, 0, -1.8));

let lastTime = performance.now();
renderer.setAnimationLoop(time => {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  if (active === null) {
    direction.set(Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
      Number(keys.has("KeyE")) - Number(keys.has("KeyQ")),
      Number(keys.has("KeyS")) - Number(keys.has("KeyW")));
    direction.normalize().applyQuaternion(camera.quaternion);
    const speed = (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 24 : 8) * speeds[speedIndex];
    velocity.lerp(direction.multiplyScalar(speed), 1 - Math.exp(-10 * dt));
    camera.position.addScaledVector(velocity, dt);
  }
  for (const [id, item] of terminals) {
    item.frame.material.color.set(id === active ? "#6be0c3" : "#7383a4");
    if (!item.dirty) continue;
    const { context, composite, pane, texture } = item;
    context.fillStyle = "#1e1e26";
    context.fillRect(0, 0, composite.width, composite.height);
    for (const layer of pane.querySelectorAll(".xterm-screen canvas")) {
      if (layer.width && layer.height) context.drawImage(layer, 0, 0, composite.width, composite.height);
    }
    texture.needsUpdate = true;
    item.dirty = false;
  }
  renderer.render(scene, camera);
});
