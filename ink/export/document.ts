import { bboxOfPoints, formatId } from '../model/geometry.ts'
import {
  SCHEMA_VERSION,
  type Metadata,
  type NoteDocument,
  type Point,
  type Stroke,
  type StrokeStyle,
} from '../model/types.ts'
import { buildStructure, DEFAULT_LAYOUT, type LayoutOptions } from '../structure/layout.ts'

/** A stroke as captured: t may use any clock (e.g. PointerEvent.timeStamp), it gets rebased. */
export interface RawStroke {
  points: Point[]
  style?: StrokeStyle
}

export interface BuildDocumentInput {
  ids: Pick<Metadata, 'courseId' | 'lectureId' | 'noteId' | 'pageId'>
  language: string
  source: Metadata['source']
  canvas: { width: number; height: number }
  strokes: readonly RawStroke[]
  label?: string | null
  createdAt?: string
  updatedAt?: string
  exportedAt?: string
  layout?: Partial<LayoutOptions>
}

function normalizeStrokes(raw: readonly RawStroke[]): Stroke[] {
  const drawn = raw.filter((s) => s.points.length > 0)
  const ordered = [...drawn].sort((a, b) => a.points[0].t - b.points[0].t)
  const t0 = ordered.length ? Math.min(...ordered.map((s) => s.points[0].t)) : 0

  return ordered.map((s, i) => {
    const points = s.points.map((pt): Point => {
      const out: Point = { x: pt.x, y: pt.y, t: Math.max(0, Math.round(pt.t - t0)) }
      if (pt.p !== undefined) out.p = Math.min(1, Math.max(0, pt.p))
      return out
    })
    const stroke: Stroke = { strokeId: formatId('s', i + 1, 4), points, bbox: bboxOfPoints(points) }
    if (s.style) stroke.style = s.style
    return stroke
  })
}

/** Builds an unrecognized document: raw strokes + layout. Recognition is filled in later. */
export function buildDocument(input: BuildDocumentInput): NoteDocument {
  const now = new Date().toISOString()
  const strokes = normalizeStrokes(input.strokes)
  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: {
      ...input.ids,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      exportedAt: input.exportedAt ?? now,
      language: input.language,
      source: input.source,
      canvas: { width: input.canvas.width, height: input.canvas.height, units: 'px' },
    },
    strokes,
    structure: buildStructure(strokes, { ...DEFAULT_LAYOUT, ...input.layout }),
    recognition: { status: 'notRecognized', engine: null, error: null, results: [] },
    gestures: [],
    groundTruth: { label: input.label || null },
  }
}
