// Render quality tier: phones (iPhone etc.) get lighter shadows, textures and
// pixel ratio so the gallery stays smooth and within mobile GPU memory.
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const small = Math.min(screen.width, screen.height) < 820;

export const MOBILE = coarse && small;
export const TOUCH = coarse || navigator.maxTouchPoints > 0;

export const Q = MOBILE
  ? { pixelRatio: Math.min(devicePixelRatio, 2), shadowMap: 2048, texScale: 0.6, panoScale: 0.5 }
  : { pixelRatio: Math.min(devicePixelRatio, 2), shadowMap: 4096, texScale: 1, panoScale: 1 };
