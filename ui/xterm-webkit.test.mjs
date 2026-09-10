import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { patchCanvasWebKitDetection, canvasWebKitBuildPlugin, canvasWebKitOptimizePlugin } from "../build/xterm-webkit.mjs";

const addon = readFileSync(new URL("../node_modules/@xterm/addon-canvas/lib/addon-canvas.js", import.meta.url), "utf8");
const tauriUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)";

// Exercise the installed addon's actual BitmapGenerator, exposing it only in
// this test VM. No browser or GPU allocations are needed to test its policy.
function generator(code, userAgent) {
  const pattern = /class (\w+)\{get bitmap\(\)[\s\S]*?this\._commitTimeout&&\(this\._commitTimeout=void 0\)\)\}\}/;
  assert.ok(pattern.test(code), "Update test harness if addon internals change");
  code = code.replace(pattern, "$&;globalThis.BitmapGeneratorForTest=$1;");
  const callbacks = [];
  let snapshots = 0;
  const context = vm.createContext({
    self: {}, navigator: { userAgent, platform: "MacIntel" },
    window: { setTimeout(callback) { callbacks.push(callback); return 1; },
      createImageBitmap() { snapshots++; return Promise.resolve({ close() {} }); } }
  });
  vm.runInContext(code, context);
  return { instance: new context.BitmapGeneratorForTest({}), callbacks, snapshots: () => snapshots };
}

test("WKWebView currently activates the bitmap path; the fix disables it", async () => {
  const before = generator(addon, tauriUA);
  before.instance.refresh();
  assert.equal(before.callbacks.length, 1);
  before.callbacks.shift()();
  await Promise.resolve();
  assert.equal(before.snapshots(), 1);
  const after = generator(patchCanvasWebKitDetection(addon), tauriUA);
  for (let i = 0; i < 10000; i++) after.instance.refresh();
  assert.equal(after.callbacks.length, 0);
  assert.equal(after.snapshots(), 0);
});

test("Safari keeps its fallback and Chromium keeps its bitmap optimization", () => {
  const patched = patchCanvasWebKitDetection(addon);
  const safari = generator(patched, tauriUA + " Version/26.0 Safari/605.1.15");
  safari.instance.refresh();
  assert.equal(safari.callbacks.length, 0);
  const chrome = generator(patched, "Mozilla/5.0 AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36");
  chrome.instance.refresh();
  assert.equal(chrome.callbacks.length, 1);
});

test("production and development paths apply the same guarded addon patch", async () => {
  const path = new URL("../node_modules/@xterm/addon-canvas/lib/addon-canvas.js", import.meta.url).pathname;
  const built = canvasWebKitBuildPlugin.transform(addon, path).code;
  let load;
  canvasWebKitOptimizePlugin.setup({ onLoad({ filter }, callback) {
    assert.ok(filter.test(path)); load = callback;
  } });
  assert.equal((await load({ path })).contents, built);
  assert.equal(canvasWebKitBuildPlugin.transform("unrelated", "/ui/main.js"), undefined);
  assert.equal(canvasWebKitBuildPlugin.transform("wrapper", "\0" + path + "?commonjs-es-import"), undefined);
  assert.throws(() => patchCanvasWebKitDetection("changed dependency"), /review/);
});
