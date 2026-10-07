import { formatId, intersects, unionBBox } from '../model/geometry.ts'
import type {
  GestureEffect,
  NoteDocument,
  RecognitionResult,
  Stroke,
} from '../model/types.ts'
import { buildStructure, linesInReadingOrder } from '../structure/layout.ts'
import { ModelNotDownloadedError, type InkRecognizer } from './InkRecognizer.ts'

export interface PipelineOptions {
  /** Text model; defaults to metadata.language. */
  modelId?: string
  /** Gesture model; null skips gesture detection. */
  gestureModelId: string | null
  /** Download missing models instead of failing. */
  autoDownload: boolean
  /** Characters of previously recognized text passed as context to the next line. */
  preContextChars: number
  /** Pass each line's bbox size as the writing area. */
  lineWritingArea: boolean
  /** A stroke is only sent to the gesture model if it crosses at least this many earlier strokes... */
  gestureMinTargets: number
  /** ...and either spans this share of their width, or was drawn after this pause (ms). */
  gestureMinWidthShare: number
  gestureMinPauseMs: number
  /** Gesture classes and what they mean for the strokes underneath. Others are treated as writing. */
  gestureEffects: Record<string, GestureEffect>
}

export const DEFAULT_PIPELINE: PipelineOptions = {
  gestureModelId: null,
  autoDownload: true,
  preContextChars: 20,
  lineWritingArea: false,
  gestureMinTargets: 2,
  gestureMinWidthShare: 0.5,
  gestureMinPauseMs: 800,
  gestureEffects: { strike: 'delete', scribble: 'delete', circle: 'emphasize' },
}

async function ensureModel(r: InkRecognizer, modelId: string, autoDownload: boolean): Promise<void> {
  if (await r.isModelDownloaded(modelId)) return
  if (!autoDownload) throw new ModelNotDownloadedError(modelId)
  await r.downloadModel(modelId)
}

function endTime(s: Stroke): number {
  return s.points[s.points.length - 1].t
}

/** Cheap geometric filter so only plausible gestures are sent to the gesture model. */
export function gestureCandidates(strokes: readonly Stroke[], opts: PipelineOptions): { stroke: Stroke; targets: Stroke[] }[] {
  const out: { stroke: Stroke; targets: Stroke[] }[] = []
  strokes.forEach((stroke, i) => {
    const targets = strokes.slice(0, i).filter((prev) => intersects(prev.bbox, stroke.bbox))
    if (targets.length < opts.gestureMinTargets) return
    const span = unionBBox(targets.map((t) => t.bbox))
    const wide = stroke.bbox.w >= opts.gestureMinWidthShare * span.w
    const late = stroke.points[0].t - Math.max(...targets.map(endTime)) >= opts.gestureMinPauseMs
    if (wide || late) out.push({ stroke, targets })
  })
  return out
}

function tail(text: string, n: number): string {
  return n > 0 ? text.slice(-n) : ''
}

/**
 * Raw strokes in, recognized document out. Never throws on engine errors: the document
 * comes back with recognition.status = "failed" so the raw ink can still be exported.
 *
 * Order: detect gestures -> rebuild layout without gesture strokes -> recognize each line
 * (kept strokes only) -> recognize what each delete-gesture removed.
 */
export async function recognizeDocument(
  input: NoteDocument,
  recognizer: InkRecognizer,
  options: Partial<PipelineOptions> = {},
): Promise<NoteDocument> {
  const opts: PipelineOptions = { ...DEFAULT_PIPELINE, ...options }
  const modelId = opts.modelId ?? input.metadata.language
  const doc: NoteDocument = structuredClone(input)
  doc.recognition = {
    status: 'failed',
    engine: {
      name: recognizer.engineName,
      modelId,
      gestureModelId: opts.gestureModelId,
      version: recognizer.engineVersion,
    },
    error: null,
    results: [],
  }
  doc.gestures = []

  try {
    await ensureModel(recognizer, modelId, opts.autoDownload)
    if (opts.gestureModelId) await ensureModel(recognizer, opts.gestureModelId, opts.autoDownload)

    const strokeById = new Map(doc.strokes.map((s) => [s.strokeId, s]))
    const gestureStrokeIds = new Set<string>()
    const deletedStrokeIds = new Set<string>()

    if (opts.gestureModelId) {
      for (const { stroke, targets } of gestureCandidates(doc.strokes, opts)) {
        const liveTargets = targets.filter((t) => !gestureStrokeIds.has(t.strokeId))
        if (liveTargets.length < opts.gestureMinTargets) continue
        const [top] = await recognizer.recognize(opts.gestureModelId, [stroke])
        const effect = top && opts.gestureEffects[top.text]
        if (!effect) continue
        gestureStrokeIds.add(stroke.strokeId)
        if (effect === 'delete') liveTargets.forEach((t) => deletedStrokeIds.add(t.strokeId))
        doc.gestures.push({
          gestureId: formatId('g', doc.gestures.length + 1, 2),
          type: top.text,
          strokeIds: [stroke.strokeId],
          score: top.score,
          targetStrokeIds: liveTargets.map((t) => t.strokeId),
          effect,
          targetRecognitionId: null,
        })
      }
      // Gesture strokes are annotations, not ink content: lay out the page without them.
      doc.structure = buildStructure(doc.strokes.filter((s) => !gestureStrokeIds.has(s.strokeId)))
    }

    const results: RecognitionResult[] = []
    const nextResultId = () => formatId('r', results.length + 1, 3)
    let written = ''

    for (const line of linesInReadingOrder(doc.structure)) {
      const kept = line.strokeIds
        .filter((id) => !deletedStrokeIds.has(id))
        .map((id) => strokeById.get(id)!)
      if (kept.length === 0) continue
      const candidates = await recognizer.recognize(modelId, kept, {
        preContext: tail(written, opts.preContextChars) || undefined,
        writingArea: opts.lineWritingArea ? { width: line.bbox.w, height: line.bbox.h } : undefined,
      })
      const recognitionId = nextResultId()
      const best = candidates[0]?.text ?? null
      results.push({ recognitionId, target: { lineId: line.lineId }, best, candidates })
      line.recognitionId = recognitionId
      if (best) written = written ? `${written} ${best}` : best
    }

    for (const gesture of doc.gestures) {
      if (gesture.effect !== 'delete') continue
      const targets = gesture.targetStrokeIds.map((id) => strokeById.get(id)!)
      const candidates = await recognizer.recognize(modelId, targets)
      const recognitionId = nextResultId()
      results.push({
        recognitionId,
        target: { gestureId: gesture.gestureId },
        best: candidates[0]?.text ?? null,
        candidates,
      })
      gesture.targetRecognitionId = recognitionId
    }

    doc.recognition.results = results
    doc.recognition.status = 'recognized'
  } catch (err) {
    doc.recognition.error = err instanceof Error ? err.message : String(err)
    doc.recognition.results = []
    doc.gestures = []
    doc.structure = structuredClone(input.structure)
  }

  return doc
}
