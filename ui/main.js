import { Channel, invoke } from "@tauri-apps/api/core";
import { FitAddon } from "@xterm/addon-fit";
import { CanvasAddon } from "@xterm/addon-canvas";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import * as THREE from "three";
import { createRocketLauncher } from "./rockets";
import { placeTerminal, planarPosition, planarLookPosition } from "./layout.mjs";
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
let speedIndex = speeds.indexOf(Number(localStorage.getItem("flight-speed")));
if (speedIndex < 0) speedIndex = 1;
function changeSpeed(delta) {
  speedIndex = Math.max(0, Math.min(speeds.length - 1, speedIndex + delta));
  localStorage.setItem("flight-speed", String(speeds[speedIndex]));
  speedControl.querySelector("output").textContent = speeds[speedIndex] + "×";
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
const rocketLauncher = createRocketLauncher(scene);
let rocketsEnabled = localStorage.getItem("rocket-launches") === "true";
const backdrop = document.createElement("canvas");
backdrop.width = backdrop.height = 512;
const backdropContext = backdrop.getContext("2d");
const wash = backdropContext.createRadialGradient(180, 150, 20, 256, 256, 390);
wash.addColorStop(0, "#f5ede3");
wash.addColorStop(1, "#e4dcda");
backdropContext.fillStyle = wash;
backdropContext.fillRect(0, 0, 512, 512);
scene.background = new THREE.CanvasTexture(backdrop);
scene.background.colorSpace = THREE.SRGBColorSpace;
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
scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: "#baaca0", size: 0.08 })));

// Keep terminal identities stable as focus changes; repeat after five windows.
const terminalPalette = [
  { background: "#191918", foreground: "#eee9df", muted: "#aaa79e", border: "#46443e" },
  { background: "#faf3df", foreground: "#39372f", muted: "#777264", border: "#d3cbb7" },
  { background: "#dfe7fa", foreground: "#303b50", muted: "#68758c", border: "#b6c3dd" },
  { background: "#e3eadc", foreground: "#354132", muted: "#6b7965", border: "#bdcab3" },
  { background: "#f1dfd9", foreground: "#4d3734", muted: "#876c66", border: "#d6b9b0" }
];
const terminals = new Map();
let layoutMode = localStorage.getItem("space-layout") === "free" ? "free" : "planar";
let selectedFont = localStorage.getItem("terminal-font") || "Menlo";
const fontControl = document.createElement("label");
fontControl.id = "font-control";
fontControl.innerHTML = '<span class="control-copy">Terminal font<small>A little character for your command line.</small></span>';
const fontSelect = document.createElement("select");
fontSelect.setAttribute("aria-label", "Terminal font");
fontSelect.add(new Option(selectedFont, selectedFont));
fontControl.append(fontSelect);
document.body.append(fontControl);
const settings = document.createElement("dialog");
settings.id = "settings";
settings.setAttribute("aria-label", "Settings");
const settingsHeader = document.createElement("header");
settingsHeader.innerHTML = '<span class="settings-eyebrow">MAKE YOURSELF AT HOME</span><h2>Settings<span aria-hidden="true">✳</span></h2><p>Your space. Your pace.</p>';
const layoutControl = document.createElement("label");
layoutControl.className = "settings-row";
layoutControl.innerHTML = '<span class="control-copy">Space layout<small>Single plane places warm black terminals around your location.</small></span>';
const layoutSelect = document.createElement("select");
layoutSelect.setAttribute("aria-label", "Space layout");
layoutSelect.add(new Option("3D · Free space", "free"));
layoutSelect.add(new Option("3D · Single plane", "planar"));
layoutSelect.value = layoutMode;
layoutControl.append(layoutSelect);
layoutSelect.addEventListener("change", () => changeLayout(layoutSelect.value));
const speedRow = document.createElement("div");
speedRow.className = "settings-row";
speedRow.innerHTML = '<span class="control-copy">Flight speed<small>Find your cruising speed.</small></span>';
speedRow.append(speedControl);
const rocketControl = document.createElement("label");
rocketControl.className = "settings-row";
rocketControl.innerHTML = '<span class="control-copy">Rocket launches<small>Launch a rocket when a command finishes.</small></span>';
const rocketToggle = document.createElement("input");
rocketToggle.type = "checkbox";
rocketToggle.setAttribute("role", "switch");
rocketToggle.setAttribute("aria-label", "Rocket launches");
rocketToggle.checked = rocketsEnabled;
rocketToggle.addEventListener("change", () => {
  rocketsEnabled = rocketToggle.checked;
  localStorage.setItem("rocket-launches", String(rocketsEnabled));
  if (!rocketsEnabled) rocketLauncher.clear();
});
rocketControl.append(rocketToggle);
const shortcuts = document.createElement("div");
shortcuts.className = "shortcuts";
shortcuts.innerHTML = `<h3>Around your space</h3>
  <div><span>Move</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></div>
  <div><span>Down / up</span><span><kbd>Q</kbd><kbd>E</kbd></span></div>
  <div><span>Boost</span><kbd>Shift</kbd></div>
  <div><span>Look around</span><span>Mouse · <kbd>F</kbd> capture</span></div>
  <div><span>New terminal</span><kbd>⌘ / Ctrl + T</kbd></div>
  <div><span>Focus terminal</span><span>Click a window</span></div>
  <div><span>Select text</span><span>Drag · double-click a word</span></div>
  <div><span>Copy selection</span><kbd>⌘ C / Ctrl + Shift + C</kbd></div>
  <div><span>Return to flight</span><kbd>Esc</kbd></div>`;
const settingsFooter = document.createElement("footer");
const footerHint = document.createElement("span");
footerHint.textContent = "Changes saved as you go";
const closeSettings = document.createElement("button");
closeSettings.type = "button";
closeSettings.textContent = "Done";
settingsFooter.append(footerHint, closeSettings);
settings.append(settingsHeader, layoutControl, fontControl, speedRow, rocketControl, shortcuts, hud, settingsFooter);
document.body.append(settings);
function dismissSettings() {
  settings.close();
  if (active !== null) terminals.get(active)?.terminal.focus();
}
function toggleSettings() {
  if (settings.open) return dismissSettings();
  document.exitPointerLock?.();
  keys.clear();
  velocity.set(0, 0, 0);
  settings.showModal();
}
closeSettings.addEventListener("click", dismissSettings);
settings.addEventListener("cancel", event => {
  event.preventDefault();
  dismissSettings();
});
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
  hud.textContent = note;
  hud.hidden = !note;
  reticle.hidden = !flying;
}

function flight() {
  if (active !== null) {
    const { pane } = terminals.get(active);
    pane.classList.remove("focused");
    pane.inert = true;
  }
  if (active !== null) terminals.get(active)?.terminal.blur();
  if (active !== null) terminals.get(active).dirty = true;
  active = null;
  keys.clear();
  velocity.set(0, 0, 0);
  updateHud();
}

function focusTerminal(id) {
  if (document.pointerLockElement) document.exitPointerLock();
  flight();
  active = id;
  terminals.get(id).dirty = true;
  const item = terminals.get(id);
  frameTerminal(item);
  item.pane.inert = false;
  item.pane.classList.add("focused");
  positionTerminalOverlay(item);
  item.terminal.focus();
  updateHud();
}

function frameTerminal({ plane }) {
  const { width, height } = plane.geometry.parameters;
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const distance = Math.max(height / 2, width / (2 * camera.aspect)) / Math.tan(halfFov) * 1.2;
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(plane.quaternion);
  camera.position.copy(plane.position).addScaledVector(normal, distance);
  camera.lookAt(plane.position);
}

function positionTerminalOverlay(item) {
  const { plane, pane, composite, padding, titleHeight, terminal, fit } = item;
  const { width, height } = plane.geometry.parameters;
  camera.updateMatrixWorld();
  plane.updateMatrixWorld();
  const project = (x, y) => new THREE.Vector3(
    (x / composite.width - 0.5) * width,
    (0.5 - y / composite.height) * height, 0
  ).applyMatrix4(plane.matrixWorld).project(camera);
  const topLeft = project(padding, titleHeight + padding);
  const bottomRight = project(composite.width - padding, composite.height - padding);
  const bounds = canvas.getBoundingClientRect();
  Object.assign(pane.style, {
    left: `${bounds.left + (topLeft.x + 1) * bounds.width / 2}px`,
    top: `${bounds.top + (1 - topLeft.y) * bounds.height / 2}px`,
    width: `${(bottomRight.x - topLeft.x) * bounds.width / 2}px`,
    height: `${(topLeft.y - bottomRight.y) * bounds.height / 2}px`
  });
  const { cols, rows } = terminal;
  fit.fit();
  item.dirty = true;
  if (item.ready && (terminal.cols !== cols || terminal.rows !== rows)) {
    invoke("resize_terminal", { id: plane.userData.id, cols: terminal.cols, rows: terminal.rows })
      .catch(error => updateHud(String(error)));
  }
}

function terminalColors(id) {
  return terminalPalette[layoutMode === "planar" ? 0 : id % terminalPalette.length];
}

function themeColors(colors) {
  return {
    ...colors, cursor: colors.foreground, cursorAccent: colors.background,
    selectionBackground: colors === terminalPalette[0] ? "#ffffff30" : "#655a4930"
  };
}

function changeLayout(mode) {
  if (mode === layoutMode) return;
  layoutMode = mode;
  localStorage.setItem("space-layout", mode);
  const placed = [];
  for (const [id, item] of terminals) {
    if (mode === "planar") {
      const position = planarPosition(item.plane.position);
      item.plane.rotation.set(0, 0, 0);
      placeTerminal(item.plane, position, placed);
      placed.push(item.plane);
    }
    item.colors = terminalColors(id);
    item.pane.style.background = item.colors.background;
    item.terminal.options.theme = { ...item.terminal.options.theme, ...themeColors(item.colors) };
    item.terminal.refresh(0, item.terminal.rows - 1);
    item.dirty = true;
  }
  if (active !== null) {
    const item = terminals.get(active);
    frameTerminal(item);
    positionTerminalOverlay(item);
  }
}

async function createTerminal(position, { focus = false } = {}) {
  const id = nextId++;
  const colors = terminalColors(id);
  const pane = document.createElement("section");
  pane.inert = true;
  pane.setAttribute("aria-label", `Terminal ${id + 1}`);
  pane.style.background = colors.background;
  sources.append(pane);
  const terminal = new Terminal({
    cursorBlink: true,
    fontFamily: fontFamily(),
    fontSize: 14,
    theme: {
      ...themeColors(colors),
      black: "#39372f", red: "#b44235", green: "#4e702d", yellow: "#896014",
      blue: "#365da4", magenta: "#8b497c", cyan: "#287475", white: "#e9e2d5",
      brightBlack: "#89857c", brightRed: "#fa936f", brightGreen: "#b3d565",
      brightYellow: "#edc879", brightBlue: "#96b9ef", brightMagenta: "#d7a0cb",
      brightCyan: "#8dc9c0", brightWhite: "#fffaf0"
    }
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(pane);
  terminal.loadAddon(new CanvasAddon());
  fit.fit();

  const source = pane.querySelector("canvas.xterm-text-layer");
  if (!source) throw new Error("Terminal canvas renderer unavailable");
  const composite = document.createElement("canvas");
  const padding = Math.round(20 * devicePixelRatio);
  composite.width = source.width + padding * 2;
  const titleHeight = Math.round(48 * devicePixelRatio);
  composite.height = source.height + padding * 2 + titleHeight;
  const texture = new THREE.CanvasTexture(composite);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8 * composite.height / composite.width),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, alphaTest: 0.01 })
  );
  plane.position.copy(position);
  // New terminals face the pilot, upright without roll or pitch.
  plane.rotation.y = layoutMode === "planar" ? 0 : camera.rotation.y;
  placeTerminal(plane, position, planes);
  plane.userData.id = id;
  scene.add(plane);
  planes.push(plane);
  const item = { terminal, fit, pane, plane, texture, composite, padding, titleHeight, colors,
    context: composite.getContext("2d"), dirty: true, ready: false };
  terminals.set(id, item);
  // xterm handles escape sequences even when they span PTY output chunks.
  terminal.parser.registerOscHandler(777, data => {
    if (!/^ttyverse;complete;\d+$/.test(data)) return false;
    if (rocketsEnabled) rocketLauncher.launch(plane);
    return true;
  });
  terminal.onRender(() => { item.dirty = true; });
  terminal.onSelectionChange(() => { item.dirty = true; });
  terminal.onScroll(() => { item.dirty = true; });
  terminal.onData((data) => {
    if (item.ready) invoke("write_terminal", { id, data }).catch(error => updateHud(String(error)));
  });
  const onOutput = new Channel();
  item.channel = onOutput;
  onOutput.onmessage = (payload) => terminal.write(new Uint8Array(payload.data));
  // Frame immediately, before PTY startup, so the initial view cannot drift.
  if (focus) focusTerminal(id);
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
  const position = layoutMode === "planar"
    ? planarLookPosition(camera.position, direction, camera.far / 2)
    : camera.position.clone().addScaledVector(direction, 12);
  flight();
  void createTerminal(position).catch(error => updateHud(String(error)));
}

function look(dx, dy) {
  camera.rotation.y -= dx * 0.002;
  camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - dy * 0.002, -1.5, 1.5);
}

window.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && (
    event.code === "Comma" || event.key === "," || event.key === "+" ||
    event.code === "Equal" || event.code === "NumpadAdd"
  )) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) toggleSettings();
    return;
  }
  if (settings.open) return;
  if (active !== null && event.ctrlKey && event.shiftKey && !event.altKey && event.code === "KeyC") {
    event.preventDefault();
    event.stopImmediatePropagation();
    // Use xterm's native copy event handler, which supplies its selected text.
    if (terminals.get(active).terminal.hasSelection()) document.execCommand("copy");
    return;
  }
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
  if (!settings.open && active === null) look(event.movementX, event.movementY);
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
  if (active !== null) {
    const item = terminals.get(active);
    frameTerminal(item);
    positionTerminalOverlay(item);
  }
}
window.addEventListener("resize", resize);
resize();
updateHud();
// Both layouts start with an upright terminal squarely facing the camera.
void createTerminal(planarPosition(camera.position), { focus: true })
  .catch(error => updateHud(String(error)));

let lastTime = performance.now();
renderer.setAnimationLoop(time => {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  rocketLauncher.update(dt);
  if (active === null && !settings.open) {
    direction.set(Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
      Number(keys.has("KeyE")) - Number(keys.has("KeyQ")),
      Number(keys.has("KeyS")) - Number(keys.has("KeyW")));
    direction.normalize().applyQuaternion(camera.quaternion);
    const speed = (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 72 : 24) * speeds[speedIndex];
    velocity.lerp(direction.multiplyScalar(speed), 1 - Math.exp(-10 * dt));
    camera.position.addScaledVector(velocity, dt);
  }
  for (const [id, item] of terminals) {
    if (!item.dirty) continue;
    const { context, composite, pane, texture, padding, titleHeight, colors } = item;
    const scale = devicePixelRatio;
    const { width, height } = composite;
    context.clearRect(0, 0, width, height);
    context.save();
    context.beginPath();
    context.roundRect(scale, scale, width - scale * 2, height - scale * 2, 24 * scale);
    context.fillStyle = colors.background;
    context.fill();
    context.strokeStyle = id === active ? colors.muted : colors.border;
    context.lineWidth = (id === active ? 2 : 1) * scale;
    context.stroke();
    context.clip();
    context.beginPath();
    context.moveTo(0, titleHeight);
    context.lineTo(width, titleHeight);
    context.strokeStyle = colors.border;
    context.lineWidth = scale;
    context.stroke();
    context.fillStyle = colors.muted;
    for (let dot = 0; dot < 3; dot++) {
      context.beginPath();
      context.arc((24 + dot * 16) * scale, titleHeight / 2, 4.5 * scale, 0, Math.PI * 2);
      context.fill();
    }
    context.font = `${13 * scale}px ${fontFamily()}`;
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.fillText(`terminal ${String(id + 1).padStart(2, "0")}`, width - padding, titleHeight / 2);
    for (const layer of pane.querySelectorAll(".xterm-screen canvas")) {
      if (layer.width && layer.height) context.drawImage(layer, padding, titleHeight + padding,
        width - padding * 2, height - titleHeight - padding * 2);
    }
    context.restore();
    texture.needsUpdate = true;
    item.dirty = false;
  }
  renderer.render(scene, camera);
});
