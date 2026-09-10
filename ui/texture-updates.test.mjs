import test from "node:test";
import assert from "node:assert/strict";
import { TextureUpdateBudget, dirtyTextureRegion } from "./texture-updates.mjs";

test("continuous floods share one bounded budget without starving terminals", () => {
  const rate = 96 * 1024 * 1024;
  const budget = new TextureUpdateBudget(rate);
  const candidates = Array.from({ length: 12 }, (_, id) => ({ id, bytes: 8 * 1024 * 1024,
    since: 0, priority: id === 0 ? 2 : 1 }));
  const updates = Array(12).fill(0);
  let bytes = 0;
  for (let time = 0; time < 10000; time += 1000 / 60) {
    const selected = budget.select([...candidates], time);
    if (selected) {
      updates[selected.id]++;
      bytes += selected.bytes;
      selected.since = time;
    }
  }
  assert.ok(bytes <= rate * 10 + budget.burst);
  assert.ok(updates.every(count => count >= 5));
  assert.ok(updates[0] >= updates[1]);
});

test("idle time cannot build an unlimited burst and oversized textures eventually progress", () => {
  const budget = new TextureUpdateBudget(100, 10);
  budget.select([], 0);
  const candidate = { bytes: 20, since: 0, priority: 1 };
  assert.equal(budget.select([candidate], 50), null);
  assert.equal(budget.select([candidate], 100), candidate);
  budget.select([], 100000);
  assert.equal(budget.credit, 10);
});

test("row patches preserve neighboring pixels and fall back to full uploads for floods", () => {
  const patch = dirtyTextureRegion(1651, 1279, 170, 1056, 33, { start: 2, end: 2 });
  assert.equal(patch.y, 232);
  assert.equal(patch.height, 36);
  assert.equal(patch.bytes, 1651 * 36 * 4);
  assert.equal(patch.full, false);
  assert.equal(dirtyTextureRegion(1651, 1279, 170, 1056, 33, { start: 0, end: 32 }).full, true);
  assert.equal(dirtyTextureRegion(1651, 1279, 170, 1056, 33, null).full, true);
});
