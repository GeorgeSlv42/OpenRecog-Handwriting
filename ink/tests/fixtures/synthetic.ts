import type { RawStroke } from '../../export/document.ts'

/**
 * Deterministic fake handwriting for layout/pipeline tests. Each "letter" is one
 * zig-zag stroke ~12x20px; real-world samples come from the harness instead.
 */
export class Pen {
  t: number
  constructor(t0 = 1000) {
    this.t = t0
  }

  stroke(points: [number, number][], pressure?: number): RawStroke {
    const out: RawStroke = {
      points: points.map(([x, y]) => {
        this.t += 8
        return pressure === undefined ? { x, y, t: this.t } : { x, y, t: this.t, p: pressure }
      }),
    }
    this.t += 120
    return out
  }

  letter(x: number, y: number, h = 20): RawStroke {
    return this.stroke([
      [x, y + h],
      [x + 3, y],
      [x + 6, y + h],
      [x + 9, y],
      [x + 12, y + h],
    ])
  }

  word(x: number, y: number, letters: number, h = 20): RawStroke[] {
    return Array.from({ length: letters }, (_, i) => this.letter(x + i * 16, y, h))
  }

  /** Horizontal line through the middle of [x0, x1] at height y. */
  strike(x0: number, x1: number, y: number): RawStroke {
    const steps = 8
    return this.stroke(
      Array.from({ length: steps + 1 }, (_, i): [number, number] => [x0 + ((x1 - x0) * i) / steps, y]),
    )
  }

  pause(ms: number): void {
    this.t += ms
  }
}

export const IDS = {
  courseId: 'course-bio101',
  lectureId: 'lecture-03',
  noteId: 'note-cell-membrane',
  pageId: 'page-1',
}

export const SOURCE = { app: 'tests', platform: 'web', inputDevice: 'pen' } as const
