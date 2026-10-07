import type { Candidate, Stroke } from '../model/types.ts'

/**
 * Engine-agnostic recognizer. The ML Kit implementation lives in the mobile app's native
 * module; anything else (MyScript, a test fake) can implement the same contract.
 *
 * Gesture classification is not a separate method: it is `recognize` with a gesture model
 * id, whose candidates' `text` is the gesture class (e.g. "strike").
 */
export interface RecognizeOptions {
  /** Text written immediately before this ink, so the engine can use it as context. */
  preContext?: string
  /** Size of the area the ink was written in. */
  writingArea?: { width: number; height: number }
}

export interface InkRecognizer {
  readonly engineName: string
  readonly engineVersion: string | null
  isModelDownloaded(modelId: string): Promise<boolean>
  /** Resolves once the model is on device. Download conditions (e.g. Wi-Fi only) are the implementation's call. */
  downloadModel(modelId: string): Promise<void>
  deleteModel(modelId: string): Promise<void>
  /** `strokes` in drawing order. Candidates ranked best-first, rank starting at 1. */
  recognize(modelId: string, strokes: readonly Stroke[], options?: RecognizeOptions): Promise<Candidate[]>
}

export class ModelNotDownloadedError extends Error {
  readonly modelId: string
  constructor(modelId: string) {
    super(`Recognition model "${modelId}" is not downloaded`)
    this.modelId = modelId
  }
}
