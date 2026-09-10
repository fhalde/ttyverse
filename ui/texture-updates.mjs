// One shared budget for the scene, not a separate allowance for every terminal.
export class TextureUpdateBudget {
  constructor(bytesPerSecond = 96 * 1024 * 1024, burstBytes = 12 * 1024 * 1024) {
    this.rate = bytesPerSecond;
    this.burst = burstBytes;
    this.credit = burstBytes;
    this.lastTime = null;
  }
  select(candidates, now) {
    const capacity = Math.max(this.burst, ...candidates.map(candidate => candidate.bytes));
    if (this.lastTime !== null) {
      this.credit = Math.min(capacity, this.credit + Math.max(0, now - this.lastTime) * this.rate / 1000);
    }
    this.lastTime = now;
    // Age keeps every visible terminal progressing; screen size only weights it.
    candidates.sort((a, b) =>
      (now - b.since + 1) * b.priority - (now - a.since + 1) * a.priority);
    const next = candidates[0];
    if (!next || next.bytes > this.credit) return null;
    this.credit -= next.bytes;
    return next; // At most one terminal upload per frame, including tiny updates.
  }
}

export function dirtyTextureRegion(width, height, textTop, sourceHeight, rows, dirtyRows) {
  if (!dirtyRows) return { y: 0, height, bytes: width * height * 4, full: true };
  // Include neighboring pixels for glyph antialiasing at row boundaries.
  const y = Math.max(0, Math.floor(textTop + dirtyRows.start * sourceHeight / rows) - 2);
  const bottom = Math.min(height, Math.ceil(textTop + (dirtyRows.end + 1) * sourceHeight / rows) + 2);
  const patchHeight = bottom - y;
  return patchHeight > height * 0.6
    ? { y: 0, height, bytes: width * height * 4, full: true }
    : { y, height: patchHeight, bytes: width * patchHeight * 4, full: false };
}
