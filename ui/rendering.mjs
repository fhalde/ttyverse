export function snapToPixel(value, density) {
  return Math.round(value * density) / density;
}

// Keep world-space frame proportions stable while matching the live text bitmap.
export function compositeSize(sourceWidth, sourceHeight, insets) {
  const width = Math.round(sourceWidth / (1 - 2 * insets.x));
  const height = Math.round(sourceHeight / (1 - insets.top - insets.bottom));
  return {
    width, height,
    padding: Math.round(width * insets.x),
    textTop: Math.round(height * insets.top),
    titleHeight: Math.round(height * (insets.top - insets.bottom))
  };
}
