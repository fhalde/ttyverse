import assert from "node:assert/strict";
import test from "node:test";
import { Profiler } from "./profiler.mjs";

test("records interval percentiles and counts, and ignores samples while stopped", () => {
  let now = 0;
  const profiler = new Profiler(() => ({ activeTerminal: 2 }), () => now);
  profiler.sample("frameMs", 999);
  profiler.start({ test: true });
  for (const value of [10, 20, 30, 40]) profiler.sample("frameMs", value);
  profiler.count("receivedBytes", 4096);
  profiler.count("receivedBytes", 1024);
  now = 1000;
  const report = profiler.stop();
  const bucket = report.timeline[0];
  assert.deepEqual(bucket.metrics.frameMs, { count: 4, mean: 25, p50: 20, p95: 40, max: 40 });
  assert.equal(bucket.counters.receivedBytes, 5120);
  assert.equal(bucket.durationMs, 1000);
  assert.equal(bucket.state.activeTerminal, 2);
  profiler.count("receivedBytes", 999);
  assert.equal(bucket.counters.receivedBytes, 5120);
  profiler.start({ test: "new recording" });
  assert.equal(profiler.timeline.length, 0);
  assert.equal(profiler.generation, 2);
});

test("bounds recording history and per-bucket sample storage", () => {
  let now = 0;
  const profiler = new Profiler(() => ({}), () => now);
  profiler.start({});
  for (let i = 0; i < 3000; i++) profiler.sample("frameMs", 16);
  assert.equal(profiler.samples.frameMs.length, 2048);
  for (let i = 0; i < 605; i++) { now += 1000; profiler.flush(); }
  assert.equal(profiler.timeline.length, 600);
  assert.equal(profiler.droppedBuckets, 5);
  assert.equal(profiler.timeline[0].elapsedMs, 6000);
});
