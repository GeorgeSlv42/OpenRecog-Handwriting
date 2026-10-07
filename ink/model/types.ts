/**
 * Ink note document, schema v1. See docs/ink-schema.md for field semantics.
 * The JSON Schema in export/schema.v1.json is the contract; these types mirror it.
 */

export const SCHEMA_VERSION = '1.0.0'

export interface Point {
  x: number
  y: number
  /** Milliseconds since the first point on the page. */
  t: number
  /** 0..1, only present when the device reports real pressure. */
  p?: number
}

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

export interface StrokeStyle {
  strokeWidth?: number
  color?: string
}

export interface Stroke {
  strokeId: string
  points: Point[]
  style?: StrokeStyle
  bbox: BBox
}

export interface Line {
  lineId: string
  /** In drawing order. */
  strokeIds: string[]
  bbox: BBox
  recognitionId: string | null
}

export type BlockType = 'text' | 'drawing' | 'unknown'

export interface Block {
  blockId: string
  type: BlockType
  bbox: BBox
  lines: Line[]
}

export interface Structure {
  blocks: Block[]
}

export interface Candidate {
  /** 1 = engine's best guess. */
  rank: number
  text: string
  /** Raw engine score, unnormalized; null when the engine doesn't provide one. */
  score: number | null
}

export interface RecognitionTarget {
  lineId?: string
  gestureId?: string
}

export interface RecognitionResult {
  recognitionId: string
  target: RecognitionTarget
  best: string | null
  candidates: Candidate[]
}

export type RecognitionStatus = 'recognized' | 'notRecognized' | 'failed'

export interface RecognitionEngine {
  name: string
  modelId: string
  gestureModelId: string | null
  version: string | null
}

export interface Recognition {
  status: RecognitionStatus
  engine: RecognitionEngine | null
  error: string | null
  results: RecognitionResult[]
}

export type GestureEffect = 'delete' | 'emphasize' | 'none'

export interface Gesture {
  gestureId: string
  /** Engine gesture class, e.g. "strike", "scribble", "circle". */
  type: string
  strokeIds: string[]
  score: number | null
  targetStrokeIds: string[]
  effect: GestureEffect
  /** Recognition of the strokes this gesture applies to (e.g. the struck-out text). */
  targetRecognitionId: string | null
}

export type SourcePlatform = 'web' | 'android' | 'ios'
export type InputDevice = 'pen' | 'touch' | 'mouse' | 'unknown'

export interface Metadata {
  courseId: string
  lectureId: string
  noteId: string
  pageId: string
  createdAt: string
  updatedAt: string
  exportedAt: string
  /** BCP-47 tag, also the recognition model to use, e.g. "en-US". */
  language: string
  source: {
    app: string
    platform: SourcePlatform
    inputDevice: InputDevice
  }
  canvas: {
    width: number
    height: number
    units: 'px'
  }
}

export interface GroundTruth {
  label: string | null
}

export interface NoteDocument {
  schemaVersion: string
  metadata: Metadata
  strokes: Stroke[]
  structure: Structure
  recognition: Recognition
  gestures: Gesture[]
  groundTruth: GroundTruth
}
