import type { Candidate, Stroke } from '../model/types.ts'
import { ModelNotDownloadedError, type InkRecognizer, type RecognizeOptions } from './InkRecognizer.ts'

/**
 * The native recognizer contract (docs/recognizer-contract.md) as TypeScript. Kotlin, Swift and
 * Rust all expose exactly this; `NativeInkRecognizer` adapts it to `InkRecognizer` once for all.
 * Optional arguments are always passed, as null, so every native signature has a fixed arity.
 */
export interface NativePoint {
  x: number
  y: number
  t: number
}

export interface NativeCandidate {
  text: string
  score: number | null
}

export interface NativeRecognizer {
  isModelDownloaded(modelId: string): Promise<boolean>
  downloadModel(modelId: string, wifiOnly: boolean): Promise<void>
  deleteModel(modelId: string): Promise<void>
  recognize(
    modelId: string,
    strokes: NativePoint[][],
    preContext: string | null,
    writingArea: { width: number; height: number } | null,
  ): Promise<NativeCandidate[]>
}

export const NATIVE_ERROR_CODES = [
  'MODEL_NOT_DOWNLOADED',
  'INVALID_MODEL_ID',
  'DOWNLOAD_FAILED',
  'DOWNLOAD_UNSUPPORTED',
  'RECOGNITION_FAILED',
  'NOT_IMPLEMENTED',
] as const

export type NativeErrorCode = (typeof NATIVE_ERROR_CODES)[number] | 'UNKNOWN'

export class RecognizerError extends Error {
  readonly code: NativeErrorCode
  constructor(code: NativeErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

/** Expo prefixes codes with ERR_ (Swift derives them from class names); Tauri sends `{ code, message }`. */
export function toRecognizerError(err: unknown): RecognizerError {
  if (err instanceof RecognizerError) return err
  const obj = typeof err === 'object' && err !== null ? (err as { code?: unknown; message?: unknown }) : {}
  const rawCode = typeof obj.code === 'string' ? obj.code.replace(/^ERR_/, '') : ''
  const code = (NATIVE_ERROR_CODES as readonly string[]).includes(rawCode) ? (rawCode as NativeErrorCode) : 'UNKNOWN'
  const message = typeof obj.message === 'string' ? obj.message : typeof err === 'string' ? err : String(err)
  return new RecognizerError(code, message)
}

export interface NativeInkRecognizerOptions {
  engineName: string
  engineVersion: string | null
  /** Passed to native downloadModel; engines without app-managed models ignore it. */
  wifiOnly?: boolean
}

export class NativeInkRecognizer implements InkRecognizer {
  readonly engineName: string
  readonly engineVersion: string | null
  private readonly native: NativeRecognizer
  private readonly wifiOnly: boolean

  constructor(native: NativeRecognizer, options: NativeInkRecognizerOptions) {
    this.native = native
    this.engineName = options.engineName
    this.engineVersion = options.engineVersion
    this.wifiOnly = options.wifiOnly ?? false
  }

  isModelDownloaded(modelId: string): Promise<boolean> {
    return this.call(modelId, () => this.native.isModelDownloaded(modelId))
  }

  downloadModel(modelId: string): Promise<void> {
    return this.call(modelId, () => this.native.downloadModel(modelId, this.wifiOnly))
  }

  deleteModel(modelId: string): Promise<void> {
    return this.call(modelId, () => this.native.deleteModel(modelId))
  }

  async recognize(modelId: string, strokes: readonly Stroke[], options: RecognizeOptions = {}): Promise<Candidate[]> {
    const nativeStrokes = strokes.map((s) => s.points.map(({ x, y, t }) => ({ x, y, t })))
    const results = await this.call(modelId, () =>
      this.native.recognize(modelId, nativeStrokes, options.preContext ?? null, options.writingArea ?? null),
    )
    return results.map((c, i) => ({ rank: i + 1, text: c.text, score: c.score ?? null }))
  }

  private async call<T>(modelId: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      const error = toRecognizerError(err)
      if (error.code === 'MODEL_NOT_DOWNLOADED') throw new ModelNotDownloadedError(modelId)
      throw error
    }
  }
}
