import { readFile } from "node:fs/promises";

const safariOnly = "/^((?!chrome|android).)*safari/i";
const webkitIncludingWebviews = "/^(?!.*(?:chrome|chromium|android)).*(?:safari|applewebkit)/i";
const addonPath = /[/\\]@xterm[/\\]addon-canvas[/\\]lib[/\\]addon-canvas\.js$/;

// addon-canvas 0.7 disables ImageBitmap snapshots on Safari, but its detector
// misses WKWebView's default UA (AppleWebKit without a Safari product token).
// Apply that existing fallback to embedded WebKit too. Keep this scoped to the
// addon: no global navigator spoofing or edits to the installed dependency.
export function patchCanvasWebKitDetection(code) {
  if (code.split(safariOnly).length !== 2) {
    throw new Error("xterm canvas platform detection changed; review the WKWebView bitmap workaround before updating.");
  }
  return code.replace(safariOnly, webkitIncludingWebviews);
}

export const canvasWebKitBuildPlugin = {
  name: "ttyverse-canvas-webkit",
  enforce: "pre",
  transform(code, id) {
    if (!id.startsWith("\0") && addonPath.test(id)) {
      return { code: patchCanvasWebKitDetection(code), map: null };
    }
  }
};

export const canvasWebKitOptimizePlugin = {
  name: "ttyverse-canvas-webkit",
  setup(build) {
    build.onLoad({ filter: addonPath }, async ({ path }) => ({
      contents: patchCanvasWebKitDetection(await readFile(path, "utf8")), loader: "js"
    }));
  }
};
