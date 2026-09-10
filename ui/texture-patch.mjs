import * as THREE from "three";

// Reused staging canvas: only changed rows cross from Canvas2D into WebGL.
// The source Texture is never rendered or initialized on the GPU.
export function createTexturePatcher(renderer) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const source = new THREE.Texture(canvas);
  const destination = new THREE.Vector2();
  return (texture, composite, region) => {
    if (canvas.width !== composite.width) canvas.width = composite.width;
    if (canvas.height !== region.height) canvas.height = region.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(composite, 0, region.y, canvas.width, canvas.height,
      0, 0, canvas.width, canvas.height);
    // CanvasTexture flips Y on upload; destination coordinates are bottom-up.
    destination.set(0, composite.height - region.y - region.height);
    renderer.copyTextureToTexture(source, texture, null, destination);
  };
}
