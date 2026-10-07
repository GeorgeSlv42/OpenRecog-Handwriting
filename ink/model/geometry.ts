import type { BBox, Point } from './types.ts'

export function bboxOfPoints(points: readonly Pick<Point, 'x' | 'y'>[]): BBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const { x, y } of points) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (minX === Infinity) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function unionBBox(boxes: readonly BBox[]): BBox {
  return bboxOfPoints(boxes.flatMap((b) => [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
  ]))
}

/** Length of the overlap of [a0, a1] and [b0, b1]; 0 when disjoint. */
export function overlap1d(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

/** Horizontal distance between two boxes; 0 when their x-ranges overlap. */
export function horizontalGap(a: BBox, b: BBox): number {
  return Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w))
}

export function intersects(a: BBox, b: BBox): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function formatId(prefix: string, n: number, width: number): string {
  return `${prefix}_${String(n).padStart(width, '0')}`
}
