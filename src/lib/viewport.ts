export interface Viewport {
  scale: number
  offsetX: number
  offsetY: number
}

export const MIN_SCALE = 0.25
export const MAX_SCALE = 4

export const DEFAULT_VIEWPORT: Viewport = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
}

export function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale))
}

export function zoomAt(
  viewport: Viewport,
  anchorX: number,
  anchorY: number,
  nextScale: number
): Viewport {
  const scale = clampScale(nextScale)
  const worldX = (anchorX - viewport.offsetX) / viewport.scale
  const worldY = (anchorY - viewport.offsetY) / viewport.scale
  return {
    scale,
    offsetX: anchorX - worldX * scale,
    offsetY: anchorY - worldY * scale,
  }
}

export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return {
    ...viewport,
    offsetX: viewport.offsetX + dx,
    offsetY: viewport.offsetY + dy,
  }
}

export function zoomPercent(scale: number): number {
  return Math.round(scale * 100)
}
