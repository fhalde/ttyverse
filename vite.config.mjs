import { defineConfig } from "vite";
import { canvasWebKitBuildPlugin, canvasWebKitOptimizePlugin } from "./build/xterm-webkit.mjs";

export default defineConfig({
  plugins: [canvasWebKitBuildPlugin],
  optimizeDeps: { esbuildOptions: { plugins: [canvasWebKitOptimizePlugin] } }
});
