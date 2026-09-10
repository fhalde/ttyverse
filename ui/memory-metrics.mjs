// Observe atlas pages without keeping obsolete canvases alive ourselves.
export class CanvasMemoryTracker {
  references = new Set();
  seen = new WeakSet();
  observe(canvas) {
    if (!canvas || this.seen.has(canvas)) return;
    this.seen.add(canvas);
    this.references.add(new WeakRef(canvas));
  }
  snapshot() {
    let pages = 0;
    let estimatedRgbaBytes = 0;
    for (const reference of this.references) {
      const canvas = reference.deref();
      if (!canvas) { this.references.delete(reference); continue; }
      pages++;
      estimatedRgbaBytes += canvas.width * canvas.height * 4;
    }
    return { observedLivePages: pages, estimatedRgbaBytes };
  }
}

export function terminalCanvasBytes(items) {
  let bytes = 0;
  for (const item of items) {
    bytes += item.composite.width * item.composite.height * 4;
    for (const canvas of item.pane.querySelectorAll(".xterm-screen canvas")) {
      bytes += canvas.width * canvas.height * 4;
    }
  }
  return bytes;
}
