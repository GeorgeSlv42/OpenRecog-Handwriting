import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDocument } from '../export/document.ts'
import { validateDocument } from '../export/validate.ts'
import { recognizeDocument } from '../recognition/pipeline.ts'
import { FakeRecognizer, GESTURE_MODEL, TEXT_MODEL } from './fixtures/FakeRecognizer.ts'
import { IDS, Pen, SOURCE } from './fixtures/synthetic.ts'

/** Line 1: "aaa" + "aaaa" with the second word struck out. Line 2: "aa". */
function notes() {
  const pen = new Pen()
  const strokes = [...pen.word(10, 10, 3), ...pen.word(80, 10, 4)]
  strokes.push(...pen.word(10, 50, 2))
  pen.pause(1500)
  strokes.push(pen.strike(78, 144, 20))
  return buildDocument({ ids: IDS, language: TEXT_MODEL, source: SOURCE, canvas: { width: 800, height: 600 }, strokes })
}

test('recognizes lines in reading order with pre-context', async () => {
  const r = new FakeRecognizer()
  const doc = await recognizeDocument(notes(), r)

  assert.equal(doc.recognition.status, 'recognized')
  assert.deepEqual(doc.recognition.engine, { name: 'fake', modelId: TEXT_MODEL, gestureModelId: null, version: '0.0.0' })
  const lines = doc.structure.blocks.flatMap((b) => b.lines)
  assert.equal(lines.length, 2)
  assert.ok(lines.every((l) => l.recognitionId))
  const textCalls = r.calls.filter((c) => c.modelId === TEXT_MODEL)
  assert.equal(textCalls[0].options?.preContext, undefined)
  assert.equal(textCalls[1].options?.preContext, doc.recognition.results[0].best)
  assert.equal(doc.recognition.results[0].candidates.length, 2)
  assert.deepEqual(validateDocument(doc).errors, [])
})

test('downloads missing models before recognizing', async () => {
  const r = new FakeRecognizer()
  await recognizeDocument(notes(), r, { gestureModelId: GESTURE_MODEL })
  assert.deepEqual([...r.downloaded].sort(), [TEXT_MODEL, GESTURE_MODEL].sort())
})

test('strike-through: struck strokes leave the line text and get their own result', async () => {
  const r = new FakeRecognizer()
  const doc = await recognizeDocument(notes(), r, { gestureModelId: GESTURE_MODEL })

  assert.equal(doc.gestures.length, 1)
  const [g] = doc.gestures
  assert.equal(g.type, 'strike')
  assert.equal(g.effect, 'delete')
  assert.equal(g.targetStrokeIds.length, 4)

  const lines = doc.structure.blocks.flatMap((b) => b.lines)
  assert.ok(lines.every((l) => !l.strokeIds.includes(g.strokeIds[0])), 'gesture stroke is not part of any line')

  const byId = new Map(doc.recognition.results.map((res) => [res.recognitionId, res]))
  assert.equal(byId.get(lines[0].recognitionId!)!.best, 'aaa', 'line 1 keeps only the unstruck word')
  assert.equal(byId.get(g.targetRecognitionId!)!.best, 'aaaa', 'struck word is still recognized')
  assert.deepEqual(byId.get(g.targetRecognitionId!)!.target, { gestureId: g.gestureId })
  assert.deepEqual(validateDocument(doc).errors, [])
})

test('ordinary letters are not sent to the gesture model', async () => {
  const r = new FakeRecognizer()
  await recognizeDocument(notes(), r, { gestureModelId: GESTURE_MODEL })
  assert.equal(r.calls.filter((c) => c.modelId === GESTURE_MODEL).length, 1)
})

test('without autoDownload a missing model fails softly and keeps raw ink', async () => {
  const input = notes()
  const doc = await recognizeDocument(input, new FakeRecognizer(), { autoDownload: false })
  assert.equal(doc.recognition.status, 'failed')
  assert.match(doc.recognition.error!, /not downloaded/)
  assert.deepEqual(doc.strokes, input.strokes)
  assert.deepEqual(validateDocument(doc).errors, [])
})

test('engine errors fail softly and do not mutate the input', async () => {
  const input = notes()
  const before = structuredClone(input)
  const r = new FakeRecognizer()
  r.failWith = new Error('engine exploded')
  const doc = await recognizeDocument(input, r, { gestureModelId: GESTURE_MODEL })
  assert.equal(doc.recognition.status, 'failed')
  assert.equal(doc.recognition.error, 'engine exploded')
  assert.deepEqual(doc.gestures, [])
  assert.deepEqual(input, before)
  assert.deepEqual(validateDocument(doc).errors, [])
})
