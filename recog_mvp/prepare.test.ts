import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { prepareDocument } from './prepare.ts'

const sample = () => JSON.parse(readFileSync(new URL('../docs/samples/harness-export.v1.json', import.meta.url), 'utf8'))

test('preserves line order and point geometry without leaking labels or old recognition', () => {
  const doc = sample()
  const prepared = prepareDocument(JSON.stringify(doc))
  assert.equal(prepared.language, 'en-US')
  assert.deepEqual(prepared.lines.map(l => l.lineId), ['l_001', 'l_002'])
  assert.deepEqual(prepared.lines[0].strokes[0].points, doc.strokes[0].points)
  assert.equal(JSON.stringify(prepared).includes('groundTruth'), false)
  assert.equal(JSON.stringify(prepared).includes('recognition'), false)
})

test('rejects wrong schemas and unresolved stroke references before invoking Windows', () => {
  const doc = sample()
  doc.schemaVersion = '2.0.0'
  assert.throws(() => prepareDocument(JSON.stringify(doc)), /schemaVersion/)
  doc.schemaVersion = '1.0.0'
  doc.structure.blocks[0].lines[0].strokeIds = ['missing']
  assert.throws(() => prepareDocument(JSON.stringify(doc)), /unknown strokeId/)
})

test('skips drawings and orders strokes by drawing time', () => {
  const doc = sample()
  doc.structure.blocks[0].lines[0].strokeIds.reverse()
  const prepared = prepareDocument(JSON.stringify(doc))
  const times = prepared.lines[0].strokes.map(s => s.points[0].t)
  assert.deepEqual(times, [...times].sort((a, b) => a - b))
  doc.structure.blocks[0].type = 'drawing'
  assert.ok(prepareDocument(JSON.stringify(doc)).lines.every(l => l.strokes.length === 0))
})

test('excludes existing gesture marks and deleted content, but keeps emphasized ink', () => {
  const doc = sample()
  doc.gestures = [{
    gestureId: 'g_01', type: 'strike', strokeIds: ['s_0010'], score: null,
    targetStrokeIds: ['s_0001'], effect: 'delete', targetRecognitionId: null,
  }]
  const ids = () => prepareDocument(JSON.stringify(doc)).lines.flatMap(l => l.strokes.map(s => s.strokeId))
  assert.ok(!ids().includes('s_0010'))
  assert.ok(!ids().includes('s_0001'))
  doc.gestures[0].effect = 'emphasize'
  assert.ok(ids().includes('s_0001'))
  assert.ok(!ids().includes('s_0010'))
})

test('accepts an empty page without manufacturing lines or text', () => {
  const doc = sample()
  doc.strokes = []
  doc.structure.blocks = []
  assert.deepEqual(prepareDocument(JSON.stringify(doc)).lines, [])
})
