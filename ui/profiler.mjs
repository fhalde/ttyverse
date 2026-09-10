function summary(values) {
  if (!values.length) return { count: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return { count: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length,
    p50: sorted[Math.floor((sorted.length - 1) * 0.5)],
    p95: sorted[Math.ceil((sorted.length - 1) * 0.95)], max: sorted.at(-1) };
}

export class Profiler {
  active = false;
  generation = 0;
  constructor(snapshot, now = () => performance.now()) {
    this.snapshot = snapshot;
    this.now = now;
  }
  start(metadata) {
    this.generation++;
    this.active = true;
    this.metadata = metadata;
    this.started = this.now();
    this.since = this.started;
    this.timeline = [];
    this.droppedBuckets = 0;
    this.resetBucket();
  }
  resetBucket() { this.samples = {}; this.counters = {}; }
  sample(name, value) {
    if (!this.active) return;
    const values = this.samples[name] ??= [];
    if (values.length < 2048) values.push(value);
  }
  count(name, value = 1) {
    if (this.active) this.counters[name] = (this.counters[name] ?? 0) + value;
  }
  flush() {
    if (!this.active) return;
    const end = this.now();
    this.timeline.push({ elapsedMs: end - this.started, durationMs: end - this.since,
      metrics: Object.fromEntries(Object.entries(this.samples).map(([key, values]) => [key, summary(values)])),
      counters: this.counters, state: this.snapshot() });
    if (this.timeline.length > 600) { this.timeline.shift(); this.droppedBuckets++; }
    this.since = end;
    this.resetBucket();
  }
  stop() {
    this.flush();
    this.active = false;
    return { version: 1, metadata: this.metadata, durationMs: this.now() - this.started,
      droppedBuckets: this.droppedBuckets, timeline: this.timeline,
      notes: ["Only the latest 600 time buckets are retained; samples capped at 2048 per metric per bucket.",
        "Memory counters estimate RGBA asset storage, not total process RAM, GPU residency, or WebKit internal copies.",
        "Atlas tracking uses weak references; obsolete pages may remain counted until garbage collection. Shared observed pages are deduplicated.",
        "writeLatencyMs includes xterm scheduling and parsing, not isolated CPU time.",
        "renderSubmitMs measures CPU submission, not GPU execution.",
        "patchSubmitMs measures partial texture transfer submission separately from renderSubmitMs.",
        "textureUploadRequests counts requested uploads, not confirmed GPU transfers.",
        "No terminal text, commands, or keystrokes are captured."] };
  }
}
