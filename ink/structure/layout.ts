import {
  formatId,
  horizontalGap,
  median,
  overlap1d,
  unionBBox,
} from '../model/geometry.ts'
import type { BBox, Block, Line, Stroke, Structure } from '../model/types.ts'

/**
 * Geometric grouping of strokes into lines and lines into blocks. ML Kit does not
 * segment a page, so this is ours. It's a heuristic tuned for left-to-right notes;
 * thresholds are relative to line height so they are zoom/DPI independent.
 */
export interface LayoutOptions {
  /** Share of the smaller vertical extent a stroke and a line must overlap to be the same line. */
  lineOverlap: number
  /** Max horizontal gap inside a line, in locally estimated text heights. */
  lineGap: number
  /** Max vertical gap between lines of one block, in median line heights. */
  blockGap: number
  /** A line taller than this many median stroke heights becomes its own "drawing" block. */
  drawingHeight: number
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  lineOverlap: 0.5,
  lineGap: 1.8,
  blockGap: 1,
  drawingHeight: 3,
}

interface LineDraft {
  strokes: Stroke[]
  bbox: BBox
}

/** Estimate text size near each stroke, without borrowing scale from distant columns.
 * Comparable-height neighbors keep dots and isolated tall strokes out of the estimate.
 */
function localTextHeights(strokes: readonly Stroke[]): Map<Stroke, number> {
  return new Map(strokes.map(stroke => {
    const s = stroke.bbox
    const neighbors = strokes.filter(other => {
      const b = other.bbox
      return b.h > 0 && b.h >= s.h * 0.5 && b.h <= s.h * 2 &&
        horizontalGap(s, b) <= 1.8 * Math.min(s.h, b.h) &&
        overlap1d(s.y, s.y + s.h, b.y, b.y + b.h) >= Math.min(s.h, b.h) * 0.45
    })
    return [stroke, Math.max(median(neighbors.map(other => other.bbox.h)), 1)] as const
  }))
}

function lineScore(stroke: Stroke, line: LineDraft, opts: LayoutOptions, heights: Map<Stroke, number>): number {
  const s = stroke.bbox
  const l = line.bbox
  const lineH = Math.max(l.h, s.h, 1)

  // Compare with nearby ink in this line, not its full (possibly inflated) bounding box.
  const nearest = [...line.strokes].sort((a, b) => horizontalGap(s, a.bbox) - horizontalGap(s, b.bbox))[0]
  const nearbyHeight = heights.get(nearest)!
  const incomingHeight = s.h < nearbyHeight * 0.3 ? nearbyHeight : heights.get(stroke)!
  const localHeight = Math.min(incomingHeight, nearbyHeight)
  if (horizontalGap(s, l) > opts.lineGap * localHeight) return 0

  const shared = overlap1d(s.y, s.y + s.h, l.y, l.y + l.h)
  const ratio = shared / Math.max(Math.min(s.h, l.h), 1)
  // Small marks (i-dots, accents) can sit just above or below the line's ink.
  const centerY = s.y + s.h / 2
  const nearBand = centerY >= l.y - lineH / 2 && centerY <= l.y + l.h + lineH / 2

  if (ratio < opts.lineOverlap && !nearBand) return 0
  return ratio + (nearBand ? 0.5 : 0)
}

/** Strokes must be in drawing order; each returned line keeps that order. */
export function groupIntoLines(strokes: readonly Stroke[], opts: LayoutOptions = DEFAULT_LAYOUT): LineDraft[] {
  const lines: LineDraft[] = []
  const heights = localTextHeights(strokes)
  for (const stroke of strokes) {
    let best: LineDraft | null = null
    let bestScore = 0
    for (const line of lines) {
      const score = lineScore(stroke, line, opts, heights)
      if (score > bestScore) {
        best = line
        bestScore = score
      }
    }
    if (best) {
      best.strokes.push(stroke)
      best.bbox = unionBBox([best.bbox, stroke.bbox])
    } else {
      lines.push({ strokes: [stroke], bbox: stroke.bbox })
    }
  }
  return lines
}

interface BlockDraft {
  lines: LineDraft[]
  bbox: BBox
  type: Block['type']
}

export function groupIntoBlocks(lines: readonly LineDraft[], opts: LayoutOptions = DEFAULT_LAYOUT): BlockDraft[] {
  // Stroke heights are dominated by letters, so this stays a stable "text size" even
  // when a page has only a couple of lines next to a big drawing.
  const textH = Math.max(median(lines.flatMap((l) => l.strokes.map((s) => s.bbox.h))), 1)
  const isDrawing = (l: LineDraft) => l.bbox.h > opts.drawingHeight * textH
  const medianH = Math.max(median(lines.filter((l) => !isDrawing(l)).map((l) => l.bbox.h)), 1)
  const blocks: BlockDraft[] = []

  const byTop = [...lines].sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x)
  for (const line of byTop) {
    if (isDrawing(line)) {
      blocks.push({ lines: [line], bbox: line.bbox, type: 'drawing' })
      continue
    }
    const target = blocks.find((b) => {
      if (b.type !== 'text') return false
      const gap = line.bbox.y - (b.bbox.y + b.bbox.h)
      const xShared = overlap1d(b.bbox.x, b.bbox.x + b.bbox.w, line.bbox.x, line.bbox.x + line.bbox.w)
      return gap <= opts.blockGap * medianH && xShared > 0
    })
    if (target) {
      target.lines.push(line)
      target.bbox = unionBBox([target.bbox, line.bbox])
    } else {
      blocks.push({ lines: [line], bbox: line.bbox, type: 'text' })
    }
  }

  return blocks.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x)
}

/** Ids are assigned in reading order: b_01.., l_001.. */
export function buildStructure(strokes: readonly Stroke[], opts: LayoutOptions = DEFAULT_LAYOUT): Structure {
  const blocks = groupIntoBlocks(groupIntoLines(strokes, opts), opts)
  let lineCount = 0
  return {
    blocks: blocks.map((b, i): Block => ({
      blockId: formatId('b', i + 1, 2),
      type: b.type,
      bbox: b.bbox,
      lines: b.lines.map((l): Line => ({
        lineId: formatId('l', ++lineCount, 3),
        strokeIds: l.strokes.map((s) => s.strokeId),
        bbox: l.bbox,
        recognitionId: null,
      })),
    })),
  }
}

/** Lines in reading order (block order, then top-to-bottom within a block). */
export function linesInReadingOrder(structure: Structure): Line[] {
  return structure.blocks.flatMap((b) => b.lines)
}
