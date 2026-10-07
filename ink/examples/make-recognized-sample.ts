/**
 * Runs the real pipeline over the real harness sample with a scripted stand-in recognizer,
 * to show what a device export looks like. The text and scores are NOT ML Kit output;
 * the engine name says so. Regenerate after schema changes:
 *
 *   node examples/make-recognized-sample.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parseDocument, serializeDocument } from '../export/serialize.ts'
import type { InkRecognizer } from '../recognition/InkRecognizer.ts'
import { recognizeDocument } from '../recognition/pipeline.ts'
import type { Candidate, Stroke } from '../model/types.ts'

const SAMPLES = new URL('../../docs/samples/', import.meta.url)
const GESTURE_MODEL = 'gesture-model-placeholder'

const scripted: Record<number, Candidate[]> = {
  3: [{ rank: 1, text: 'abc', score: 1.2 }, { rank: 2, text: 'abe', score: 2.9 }, { rank: 3, text: 'obc', score: 3.4 }],
  4: [{ rank: 1, text: 'defg', score: 0.9 }, { rank: 2, text: 'defy', score: 2.1 }],
  2: [{ rank: 1, text: 'hi', score: 0.4 }, { rank: 2, text: 'hl', score: 1.8 }, { rank: 3, text: 'Hi', score: 2.2 }],
}

const stub: InkRecognizer = {
  engineName: 'example-stub (not ML Kit)',
  engineVersion: null,
  isModelDownloaded: async () => true,
  downloadModel: async () => {},
  deleteModel: async () => {},
  async recognize(modelId: string, strokes: readonly Stroke[]) {
    if (modelId === GESTURE_MODEL) {
      return strokes[0].bbox.h < 2
        ? [{ rank: 1, text: 'strike', score: 0.3 }, { rank: 2, text: 'writing', score: 1.7 }]
        : [{ rank: 1, text: 'writing', score: 0.2 }]
    }
    return scripted[strokes.length] ?? [{ rank: 1, text: '?', score: null }]
  },
}

const input = parseDocument(readFileSync(new URL('harness-export.v1.json', SAMPLES), 'utf8'))
input.metadata.source = { app: 'mobile', platform: 'android', inputDevice: 'pen' }
const doc = await recognizeDocument(input, stub, { gestureModelId: GESTURE_MODEL })
doc.metadata.exportedAt = '2026-10-07T16:40:00.000Z'
writeFileSync(new URL('recognized.example.v1.json', SAMPLES), serializeDocument(doc) + '\n')
console.log(`wrote recognized.example.v1.json: ${doc.recognition.status}, ${doc.recognition.results.length} results, ${doc.gestures.length} gestures`)
