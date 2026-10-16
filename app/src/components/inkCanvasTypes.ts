import type { InputDevice, RawStroke } from '@openrecog-handwriting/ink'

export interface InkCanvasSnapshot {
  sessionId: number
  revision: number
  strokes: RawStroke[]
  inputDevice: InputDevice
  missing: number
  isDrawing: boolean
  width: number
  height: number
}
