import type { InkRecognizer, RecognizeOptions } from '../../recognition/InkRecognizer.ts'
import type { Candidate, Stroke } from '../../model/types.ts'

export const TEXT_MODEL = 'en-US'
export const GESTURE_MODEL = 'test-gesture'

export interface RecognizeCall {
  modelId: string
  strokeIds: string[]
  options?: RecognizeOptions
}

/**
 * Text model: one "a" per stroke, so tests can tell which strokes were sent.
 * Gesture model: flat wide strokes are "strike", everything else "writing".
 */
export class FakeRecognizer implements InkRecognizer {
  readonly engineName = 'fake'
  readonly engineVersion = '0.0.0'
  readonly downloaded = new Set<string>()
  readonly calls: RecognizeCall[] = []
  failWith: Error | null = null

  async isModelDownloaded(modelId: string): Promise<boolean> {
    return this.downloaded.has(modelId)
  }

  async downloadModel(modelId: string): Promise<void> {
    this.downloaded.add(modelId)
  }

  async deleteModel(modelId: string): Promise<void> {
    this.downloaded.delete(modelId)
  }

  async recognize(modelId: string, strokes: readonly Stroke[], options?: RecognizeOptions): Promise<Candidate[]> {
    if (this.failWith) throw this.failWith
    if (!this.downloaded.has(modelId)) throw new Error(`model ${modelId} not loaded`)
    this.calls.push({ modelId, strokeIds: strokes.map((s) => s.strokeId), options })

    if (modelId === GESTURE_MODEL) {
      const b = strokes[0].bbox
      return b.h < 2 && b.w > 30
        ? [{ rank: 1, text: 'strike', score: 0.1 }, { rank: 2, text: 'writing', score: 0.9 }]
        : [{ rank: 1, text: 'writing', score: 0.2 }]
    }
    const text = 'a'.repeat(strokes.length)
    return [
      { rank: 1, text, score: 1.5 },
      { rank: 2, text: text.toUpperCase(), score: 2.5 },
    ]
  }
}
