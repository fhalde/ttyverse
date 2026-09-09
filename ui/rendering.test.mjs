import assert from "node:assert/strict";
import test from "node:test";
import { compositeSize, snapToPixel } from "./rendering.mjs";

test("overlay edges land on physical pixels at fractional display densities", () => {
  for (const density of [1, 1.25, 1.5, 2, 3]) {
    for (const edge of [-12.73, 0, 13.37, 991.19]) {
      const snapped = snapToPixel(edge, density);
      assert.ok(Math.abs(snapped * density - Math.round(snapped * density)) < 1e-9);
      assert.ok(Math.abs(snapped - edge) <= 0.5 / density + 1e-9);
    }
  }
});

test("resized text bitmaps fit without scaling and preserve frame proportions", () => {
  const insets = { x: 20 / 680, top: 68 / 508, bottom: 20 / 508 };
  for (const [sourceWidth, sourceHeight] of [[640, 420], [1280, 840], [1773, 923], [320, 210]]) {
    const size = compositeSize(sourceWidth, sourceHeight, insets);
    assert.ok(size.padding + sourceWidth <= size.width);
    assert.ok(size.textTop + sourceHeight <= size.height);
    assert.ok(Math.abs(size.padding / size.width - insets.x) <= 1 / size.width);
    assert.ok(Math.abs(size.textTop / size.height - insets.top) <= 1 / size.height);
    assert.ok(Math.abs(size.width - sourceWidth - 2 * size.padding) <= 1);
  }
});
