import assert from "node:assert/strict";
import test from "node:test";
import { CanvasMemoryTracker, terminalCanvasBytes } from "./memory-metrics.mjs";

test("shared atlas pages are counted once and resized dimensions are reflected", () => {
  const tracker = new CanvasMemoryTracker();
  const page = { width: 512, height: 512 };
  tracker.observe(page);
  tracker.observe(page);
  tracker.observe(undefined);
  assert.deepEqual(tracker.snapshot(), { observedLivePages: 1, estimatedRgbaBytes: 1048576 });
  page.width = 1024;
  assert.equal(tracker.snapshot().estimatedRgbaBytes, 2097152);
});

test("terminal storage estimate includes the composite and all text layers", () => {
  const item = { composite: { width: 100, height: 80 }, pane: {
    querySelectorAll: () => [{ width: 80, height: 50 }, { width: 80, height: 50 }]
  } };
  assert.equal(terminalCanvasBytes([item]), 64000);
});
