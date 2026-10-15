import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDocument } from '../export/document.ts'
import { validateDocument } from '../export/validate.ts'
import { ModelNotDownloadedError } from '../recognition/InkRecognizer.ts'
import {
  NativeInkRecognizer,
  RecognizerError,
  toRecognizerError,
  type NativeRecognizer,
} from '../recognition/NativeRecognizer.ts'
import { recognizeDocument } from '../recognition/pipeline.ts'
import { IDS, Pen, SOURCE } from './fixtures/synthetic.ts'

function fakeNative(overrides: Partial<NativeRecognizer> = {}) {
  const calls: { fn: string; args: unknown[] }[] = []
  const native: NativeRecognizer = {
    async isModelDownloaded(...args) { calls.push({ fn: 'isModelDownloaded', args }); return true },
    async downloadModel(...args) { calls.push({ fn: 'downloadModel', args }) },
    async deleteModel(...args) { calls.push({ fn: 'deleteModel', args }) },
    async recognize(...args) {
      calls.push({ fn: 'recognize', args })
      return [{ text: 'hello', score: null }, { text: 'hallo', score: null }]
    },
    ...overrides,
  }
  return { native, calls }
}

function page() {
  const pen = new Pen()
  return buildDocument({
    ids: IDS, language: 'en-US', source: SOURCE, canvas: { width: 800, height: 600 },
    strokes: pen.word(10, 10, 3).map((s) => ({ ...s, points: s.points.map((p) => ({ ...p, p: 0.5 })) })),
  })
}

test('sends plain {x,y,t} strokes with null optionals and ranks candidates from 1', async () => {
  const { native, calls } = fakeNative()
  const r = new NativeInkRecognizer(native, { engineName: 'test', engineVersion: null })
  const doc = page()
  const candidates = await r.recognize('en-US', doc.strokes)

  assert.deepEqual(candidates, [
    { rank: 1, text: 'hello', score: null },
    { rank: 2, text: 'hallo', score: null },
  ])
  const [modelId, strokes, preContext, writingArea] = calls[0].args as [string, object[][], unknown, unknown]
  assert.equal(modelId, 'en-US')
  assert.deepEqual(Object.keys(strokes[0][0]), ['x', 'y', 't'])
  assert.equal(preContext, null)
  assert.equal(writingArea, null)
})

test('passes wifiOnly through to native downloadModel', async () => {
  const { native, calls } = fakeNative()
  await new NativeInkRecognizer(native, { engineName: 'test', engineVersion: null, wifiOnly: true }).downloadModel('en-US')
  assert.deepEqual(calls[0], { fn: 'downloadModel', args: ['en-US', true] })
})

test('maps MODEL_NOT_DOWNLOADED (with or without ERR_ prefix) to ModelNotDownloadedError', async () => {
  for (const code of ['MODEL_NOT_DOWNLOADED', 'ERR_MODEL_NOT_DOWNLOADED']) {
    const { native } = fakeNative({ recognize: async () => { throw Object.assign(new Error('nope'), { code }) } })
    const r = new NativeInkRecognizer(native, { engineName: 'test', engineVersion: null })
    await assert.rejects(r.recognize('en-US', page().strokes), ModelNotDownloadedError)
  }
})

test('normalizes Expo errors, Tauri {code,message} objects, strings and unknown codes', () => {
  assert.equal(toRecognizerError(Object.assign(new Error('x'), { code: 'ERR_NOT_IMPLEMENTED' })).code, 'NOT_IMPLEMENTED')
  const tauri = toRecognizerError({ code: 'DOWNLOAD_UNSUPPORTED', message: 'Install handwriting in Settings' })
  assert.equal(tauri.code, 'DOWNLOAD_UNSUPPORTED')
  assert.equal(tauri.message, 'Install handwriting in Settings')
  assert.equal(toRecognizerError('boom').message, 'boom')
  assert.equal(toRecognizerError({ code: 'SOMETHING_ELSE', message: 'm' }).code, 'UNKNOWN')
  assert.ok(toRecognizerError(null) instanceof RecognizerError)
})

test('pipeline soft-fails with the native message when download is unsupported', async () => {
  const { native } = fakeNative({
    isModelDownloaded: async () => false,
    downloadModel: async () => { throw { code: 'DOWNLOAD_UNSUPPORTED', message: 'Install handwriting for en-US in Windows Settings' } },
  })
  const doc = await recognizeDocument(page(), new NativeInkRecognizer(native, { engineName: 'windows-ink', engineVersion: null }))
  assert.equal(doc.recognition.status, 'failed')
  assert.equal(doc.recognition.error, 'Install handwriting for en-US in Windows Settings')
  assert.deepEqual(validateDocument(doc).errors, [])
})

test('end to end through the pipeline produces a valid recognized document', async () => {
  const { native } = fakeNative()
  const doc = await recognizeDocument(page(), new NativeInkRecognizer(native, { engineName: 'test', engineVersion: '1' }))
  assert.equal(doc.recognition.status, 'recognized')
  assert.equal(doc.recognition.results[0].best, 'hello')
  assert.deepEqual(validateDocument(doc).errors, [])
})
